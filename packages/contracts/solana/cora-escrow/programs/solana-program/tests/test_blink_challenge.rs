mod common;

use {
    anchor_lang::{
        solana_program::{clock::Clock, instruction::Instruction},
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_ed25519_program::new_ed25519_instruction_with_signature,
    solana_keypair::Keypair,
    solana_pubkey::Pubkey,
    solana_signer::Signer,
};
use common::*;

fn setup() -> (LiteSVM, Pubkey) {
    let pid = solana_program::id();
    let mut svm = LiteSVM::new();
    svm.add_program(pid, include_bytes!("../../../target/deploy/solana_program.so")).unwrap();
    (svm, pid)
}

fn build_settle_ixs(
    pid: Pubkey, server: &Keypair, match_id: [u8; 32], action: u8, target: Pubkey,
    match_pda: Pubkey, vault_pda: Pubkey, config_pda: Pubkey,
    pa_tok: Pubkey, pb_tok: Pubkey, treasury_tok: Pubkey, mint_pk: Pubkey,
) -> Vec<Instruction> {
    let mut message = [0u8; 65];
    message[0] = action;
    message[1..33].copy_from_slice(&match_id);
    message[33..65].copy_from_slice(&target.to_bytes());
    let signature = server.sign_message(&message);
    let sig_bytes: [u8; 64] = signature.into();

    let ed25519_ix = new_ed25519_instruction_with_signature(
        &message, &sig_bytes, &server.pubkey().to_bytes(),
    );
    let settle_ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::SettleMatch { action, target, signature: sig_bytes }.data(),
        solana_program::accounts::SettleMatch {
            caller: server.pubkey(),
            match_state: match_pda,
            vault: vault_pda,
            player_a_token_account: pa_tok,
            player_b_token_account: pb_tok,
            config: config_pda,
            treasury: treasury_tok,
            token_mint: mint_pk,
            token_program: TOKEN_PROGRAM_ID,
            instructions_sysvar: INSTRUCTIONS_SYSVAR_ID,
        }.to_account_metas(None),
    );
    vec![ed25519_ix, settle_ix]
}

fn build_refund_ix(
    pid: Pubkey, caller: Pubkey, match_pda: Pubkey, vault_pda: Pubkey,
    pa_tok: Pubkey, pb_tok: Pubkey, mint_pk: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::Refund {}.data(),
        solana_program::accounts::Refund {
            caller,
            match_state: match_pda,
            vault: vault_pda,
            player_a_token_account: pa_tok,
            player_b_token_account: pb_tok,
            token_mint: mint_pk,
            token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    )
}

#[test]
fn test_create_open_challenge_happy_path() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(
        &mut svm,
        &creator_token.pubkey(),
        &token_mint.pubkey(),
        &creator.pubkey(),
        5_000_000,
    );

    let match_id = [41u8; 32];
    let (challenge_pda, challenge_vault_pda) = do_create_open_challenge(
        &mut svm,
        pid,
        &creator,
        creator_token.pubkey(),
        token_mint.pubkey(),
        match_id,
        WAGER_AMOUNT,
        server.pubkey(),
    );

    let challenge: solana_program::state::OpenChallengeState =
        get_anchor_account(&mut svm, &challenge_pda);
    assert_eq!(challenge.creator, creator.pubkey());
    assert_eq!(challenge.token_mint, token_mint.pubkey());
    assert_eq!(challenge.server_pubkey, server.pubkey());
    assert_eq!(challenge.wager_amount, WAGER_AMOUNT);
    assert_eq!(challenge.version, 1);
    assert_eq!(get_token_balance(&mut svm, &challenge_vault_pda), WAGER_AMOUNT);
    assert_eq!(
        get_token_balance(&mut svm, &creator_token.pubkey()),
        5_000_000 - WAGER_AMOUNT
    );
}

#[test]
fn test_create_open_challenge_below_min_wager_fails() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(
        &mut svm,
        &creator_token.pubkey(),
        &token_mint.pubkey(),
        &creator.pubkey(),
        5_000_000,
    );

    let match_id = [42u8; 32];
    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::CreateOpenChallenge {
            match_id,
            wager_amount: 1,
            server_pubkey: server.pubkey(),
        }.data(),
        solana_program::accounts::CreateOpenChallenge {
            creator: creator.pubkey(),
            token_mint: token_mint.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            creator_token_account: creator_token.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &creator, &[&creator]);
    assert!(res.is_err(), "Wager below MIN_WAGER should be rejected");
}

#[test]
fn test_accept_challenge_happy_path_preserves_created_at_and_rent() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let challenger = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    let challenger_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_token.pubkey(), &token_mint.pubkey(), &challenger.pubkey(), 5_000_000);

    let match_id = [43u8; 32];
    let (challenge_pda, challenge_vault_pda) = do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );
    let challenge: solana_program::state::OpenChallengeState =
        get_anchor_account(&mut svm, &challenge_pda);
    let creator_lamports_before_accept = get_lamports(&mut svm, &creator.pubkey());
    let challenge_state_lamports = get_lamports(&mut svm, &challenge_pda);
    let challenge_vault_lamports = get_lamports(&mut svm, &challenge_vault_pda);

    let (match_pda, vault_pda) = do_accept_challenge(
        &mut svm, pid, &challenger, creator.pubkey(),
        challenger_token.pubkey(), token_mint.pubkey(), match_id,
    );

    let creator_lamports_after_accept = get_lamports(&mut svm, &creator.pubkey());
    let match_state: solana_program::state::MatchState =
        get_anchor_account(&mut svm, &match_pda);
    assert_eq!(match_state.version, 1);
    assert_eq!(match_state.bump, Pubkey::find_program_address(&[b"match", &match_id], &pid).1);
    assert_eq!(match_state.player_a, creator.pubkey());
    assert_eq!(match_state.player_b, challenger.pubkey());
    assert!(match_state.status == solana_program::state::MatchStatus::Active);
    assert_eq!(match_state.created_at, challenge.created_at);
    assert_eq!(get_token_balance(&mut svm, &vault_pda), WAGER_AMOUNT * 2);
    assert!(svm.get_account(&challenge_pda).is_none(), "challenge state should be closed");
    assert!(svm.get_account(&challenge_vault_pda).is_none(), "challenge vault should be closed");
    assert_eq!(
        creator_lamports_after_accept,
        creator_lamports_before_accept + challenge_state_lamports + challenge_vault_lamports
    );
}

#[test]
fn test_accept_challenge_expired_fails() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let challenger = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    let challenger_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_token.pubkey(), &token_mint.pubkey(), &challenger.pubkey(), 5_000_000);

    let match_id = [44u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );

    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 910;
    svm.set_sysvar(&clock);

    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::AcceptChallenge { match_id }.data(),
        solana_program::accounts::AcceptChallenge {
            challenger: challenger.pubkey(),
            creator: creator.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            token_mint: token_mint.pubkey(),
            match_state: match_pda,
            vault: vault_pda,
            challenger_token_account: challenger_token.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &challenger, &[&challenger]);
    assert!(res.is_err(), "Expired challenge accept should fail");
}

#[test]
fn test_accept_challenge_creator_cannot_accept_own_challenge() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);

    let match_id = [45u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );

    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::AcceptChallenge { match_id }.data(),
        solana_program::accounts::AcceptChallenge {
            challenger: creator.pubkey(),
            creator: creator.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            token_mint: token_mint.pubkey(),
            match_state: match_pda,
            vault: vault_pda,
            challenger_token_account: creator_token.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &creator, &[&creator]);
    assert!(res.is_err(), "Creator should not accept their own challenge");
}

#[test]
fn test_reclaim_challenge_after_expiry() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);

    let match_id = [46u8; 32];
    let (challenge_pda, challenge_vault_pda) = do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );

    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 910;
    svm.set_sysvar(&clock);

    do_reclaim_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id,
    );
    assert_eq!(get_token_balance(&mut svm, &creator_token.pubkey()), 5_000_000);
    assert!(svm.get_account(&challenge_pda).is_none(), "challenge state should be closed");
    assert!(svm.get_account(&challenge_vault_pda).is_none(), "challenge vault should be closed");
}

#[test]
fn test_reclaim_challenge_before_expiry_fails() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);

    let match_id = [47u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );

    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::ReclaimChallenge {}.data(),
        solana_program::accounts::ReclaimChallenge {
            creator: creator.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            creator_token_account: creator_token.pubkey(),
            token_mint: token_mint.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &creator, &[&creator]);
    assert!(res.is_err(), "Reclaim before expiry should fail");
}

#[test]
fn test_accept_then_settle_match_full_lifecycle() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let challenger = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    let creator_token = Keypair::new();
    let challenger_token = Keypair::new();
    let treasury_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_token.pubkey(), &token_mint.pubkey(), &challenger.pubkey(), 5_000_000);
    create_token_account(&mut svm, &treasury_token.pubkey(), &token_mint.pubkey(), &treasury.pubkey(), 0);

    let match_id = [48u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );
    let (match_pda, vault_pda) = do_accept_challenge(
        &mut svm, pid, &challenger, creator.pubkey(), challenger_token.pubkey(), token_mint.pubkey(), match_id,
    );
    let config_pda = do_init_config(&mut svm, pid, &server, treasury.pubkey());

    let ixs = build_settle_ixs(
        pid, &server, match_id, 0, challenger.pubkey(),
        match_pda, vault_pda, config_pda,
        creator_token.pubkey(), challenger_token.pubkey(), treasury_token.pubkey(), token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &ixs, &server, &[&server]);
    assert!(res.is_ok(), "Settlement after accept should succeed: {:?}", res.err());

    let total = WAGER_AMOUNT * 2;
    let fee = total * 250 / 10_000;
    let winner_payout = total - fee;
    assert_eq!(get_token_balance(&mut svm, &treasury_token.pubkey()), fee);
    assert_eq!(
        get_token_balance(&mut svm, &challenger_token.pubkey()),
        5_000_000 - WAGER_AMOUNT + winner_payout
    );
    assert!(svm.get_account(&match_pda).is_none(), "match state should be closed");
    assert!(svm.get_account(&vault_pda).is_none(), "vault should be closed");
}

#[test]
fn test_accept_then_refund_after_active_timeout() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let challenger = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    let challenger_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_token.pubkey(), &token_mint.pubkey(), &challenger.pubkey(), 5_000_000);

    let match_id = [49u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );
    let (match_pda, vault_pda) = do_accept_challenge(
        &mut svm, pid, &challenger, creator.pubkey(), challenger_token.pubkey(), token_mint.pubkey(), match_id,
    );

    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 910;
    svm.set_sysvar(&clock);

    let refund_ix = build_refund_ix(
        pid, creator.pubkey(), match_pda, vault_pda,
        creator_token.pubkey(), challenger_token.pubkey(), token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &[refund_ix], &creator, &[&creator]);
    assert!(res.is_ok(), "Refund after accept+timeout should succeed: {:?}", res.err());
    assert_eq!(get_token_balance(&mut svm, &creator_token.pubkey()), 5_000_000);
    assert_eq!(get_token_balance(&mut svm, &challenger_token.pubkey()), 5_000_000);
}

#[test]
fn test_duplicate_accept_race_second_challenger_fails() {
    let (mut svm, pid) = setup();
    let creator = Keypair::new();
    let challenger_a = Keypair::new();
    let challenger_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let creator_token = Keypair::new();
    let challenger_a_token = Keypair::new();
    let challenger_b_token = Keypair::new();
    svm.airdrop(&creator.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&challenger_b.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &creator.pubkey(), 6);
    create_token_account(&mut svm, &creator_token.pubkey(), &token_mint.pubkey(), &creator.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_a_token.pubkey(), &token_mint.pubkey(), &challenger_a.pubkey(), 5_000_000);
    create_token_account(&mut svm, &challenger_b_token.pubkey(), &token_mint.pubkey(), &challenger_b.pubkey(), 5_000_000);

    let match_id = [50u8; 32];
    do_create_open_challenge(
        &mut svm, pid, &creator, creator_token.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT, server.pubkey(),
    );
    do_accept_challenge(
        &mut svm, pid, &challenger_a, creator.pubkey(), challenger_a_token.pubkey(), token_mint.pubkey(), match_id,
    );

    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::AcceptChallenge { match_id }.data(),
        solana_program::accounts::AcceptChallenge {
            challenger: challenger_b.pubkey(),
            creator: creator.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            token_mint: token_mint.pubkey(),
            match_state: match_pda,
            vault: vault_pda,
            challenger_token_account: challenger_b_token.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &challenger_b, &[&challenger_b]);
    assert!(res.is_err(), "Second accept should fail after first challenger closes the challenge");
}
