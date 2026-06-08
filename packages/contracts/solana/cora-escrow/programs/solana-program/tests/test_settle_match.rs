mod common;

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
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

/// Build a settle instruction with ed25519 precompile
fn build_settle_ixs(
    pid: Pubkey, server: &Keypair, match_id: [u8; 32], action: u8, target: Pubkey,
    match_pda: Pubkey, vault_pda: Pubkey, config_pda: Pubkey,
    pa_tok: Pubkey, pb_tok: Pubkey, treasury_tok: Pubkey,
    mint_pk: Pubkey,
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
            caller: server.pubkey(), match_state: match_pda, vault: vault_pda,
            player_a_token_account: pa_tok, player_b_token_account: pb_tok,
            config: config_pda, treasury: treasury_tok,
            token_mint: mint_pk, token_program: TOKEN_PROGRAM_ID,
            instructions_sysvar: INSTRUCTIONS_SYSVAR_ID,
        }.to_account_metas(None),
    );
    vec![ed25519_ix, settle_ix]
}

#[test]
fn test_settle_match_happy_path() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();

    let match_id: [u8; 32] = [20u8; 32];
    let am = setup_active_match(&mut svm, pid, &player_a, &player_b, &server, &token_mint, &treasury, match_id);

    let ixs = build_settle_ixs(
        pid, &server, match_id, 0, player_a.pubkey(),
        am.match_pda, am.vault_pda, am.config_pda,
        am.player_a_token, am.player_b_token, am.treasury_token,
        token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &ixs, &server, &[&server]);
    assert!(res.is_ok(), "Settle should succeed: {:?}", res.err());

    let total = WAGER_AMOUNT * 2;
    let fee = total * 250 / 10_000;
    let winner_payout = total - fee;
    assert_eq!(get_token_balance(&mut svm, &am.treasury_token), fee);
    assert_eq!(get_token_balance(&mut svm, &am.player_a_token), 5_000_000 - WAGER_AMOUNT + winner_payout);

    // Verify accounts are closed
    assert!(svm.get_account(&am.match_pda).is_none(), "match_state should be closed");
    assert!(svm.get_account(&am.vault_pda).is_none(), "vault should be closed");
}

#[test]
fn test_settle_match_cheater_penalty() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();

    let match_id: [u8; 32] = [21u8; 32];
    let am = setup_active_match(&mut svm, pid, &player_a, &player_b, &server, &token_mint, &treasury, match_id);

    // action=1, target=cheater (player_b)
    let ixs = build_settle_ixs(
        pid, &server, match_id, 1, player_b.pubkey(),
        am.match_pda, am.vault_pda, am.config_pda,
        am.player_a_token, am.player_b_token, am.treasury_token,
        token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &ixs, &server, &[&server]);
    assert!(res.is_ok(), "Penalty settle should succeed: {:?}", res.err());

    assert_eq!(get_token_balance(&mut svm, &am.treasury_token), WAGER_AMOUNT, "Treasury gets cheater's wager");
    assert_eq!(get_token_balance(&mut svm, &am.player_a_token), 5_000_000, "Honest player gets full refund");

    // Verify accounts are closed
    assert!(svm.get_account(&am.match_pda).is_none(), "match_state should be closed");
    assert!(svm.get_account(&am.vault_pda).is_none(), "vault should be closed");
}

#[test]
fn test_settle_after_settled_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();

    let match_id: [u8; 32] = [22u8; 32];
    let am = setup_active_match(&mut svm, pid, &player_a, &player_b, &server, &token_mint, &treasury, match_id);

    // First settle succeeds
    let ixs = build_settle_ixs(
        pid, &server, match_id, 0, player_a.pubkey(),
        am.match_pda, am.vault_pda, am.config_pda,
        am.player_a_token, am.player_b_token, am.treasury_token,
        token_mint.pubkey(),
    );
    send_tx(&mut svm, &ixs, &server, &[&server]).unwrap();

    // Second settle should fail (match already Settled, not Active)
    let ixs2 = build_settle_ixs(
        pid, &server, match_id, 0, player_b.pubkey(),
        am.match_pda, am.vault_pda, am.config_pda,
        am.player_a_token, am.player_b_token, am.treasury_token,
        token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &ixs2, &server, &[&server]);
    assert!(res.is_err(), "Re-settlement should fail");
}

#[test]
fn test_settle_wrong_treasury_authority_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    let attacker = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();

    let match_id: [u8; 32] = [23u8; 32];
    let am = setup_active_match(&mut svm, pid, &player_a, &player_b, &server, &token_mint, &treasury, match_id);

    // Attacker creates their own token account to steal fees
    let fake_treasury = Keypair::new();
    create_token_account(&mut svm, &fake_treasury.pubkey(), &token_mint.pubkey(), &attacker.pubkey(), 0);

    // Try to settle with attacker's treasury — should fail because authority doesn't match config
    let ixs = build_settle_ixs(
        pid, &server, match_id, 0, player_a.pubkey(),
        am.match_pda, am.vault_pda, am.config_pda,
        am.player_a_token, am.player_b_token, fake_treasury.pubkey(),
        token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &ixs, &server, &[&server]);
    assert!(res.is_err(), "Settlement with wrong treasury authority should fail");
}
