mod common;

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
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

#[test]
fn test_deposit_wager_happy_path() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [10u8; 32];
    let (match_pda, vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );

    let pa_tok = Keypair::new();
    create_token_account(&mut svm, &pa_tok.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    do_deposit(&mut svm, pid, &player_a, match_pda, vault_pda, pa_tok.pubkey(), token_mint.pubkey());

    assert_eq!(get_token_balance(&mut svm, &vault_pda), WAGER_AMOUNT);
    assert_eq!(get_token_balance(&mut svm, &pa_tok.pubkey()), 5_000_000 - WAGER_AMOUNT);
}

#[test]
fn test_deposit_both_players_activates_match() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [11u8; 32];
    let (match_pda, vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );

    let pa_tok = Keypair::new();
    let pb_tok = Keypair::new();
    create_token_account(&mut svm, &pa_tok.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    create_token_account(&mut svm, &pb_tok.pubkey(), &token_mint.pubkey(), &player_b.pubkey(), 5_000_000);

    do_deposit(&mut svm, pid, &player_a, match_pda, vault_pda, pa_tok.pubkey(), token_mint.pubkey());
    do_deposit(&mut svm, pid, &player_b, match_pda, vault_pda, pb_tok.pubkey(), token_mint.pubkey());

    assert_eq!(get_token_balance(&mut svm, &vault_pda), WAGER_AMOUNT * 2);
}

#[test]
fn test_deposit_unauthorized_player_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let attacker = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [12u8; 32];
    let (match_pda, vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );

    let attacker_tok = Keypair::new();
    create_token_account(&mut svm, &attacker_tok.pubkey(), &token_mint.pubkey(), &attacker.pubkey(), 5_000_000);

    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager {
            depositor: attacker.pubkey(), match_state: match_pda,
            depositor_token_account: attacker_tok.pubkey(), vault: vault_pda,
            token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert!(res.is_err(), "Unauthorized player should not be able to deposit");
}

#[test]
fn test_deposit_double_deposit_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [13u8; 32];
    let (match_pda, vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );

    let pa_tok = Keypair::new();
    create_token_account(&mut svm, &pa_tok.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);

    // First deposit should succeed
    do_deposit(&mut svm, pid, &player_a, match_pda, vault_pda, pa_tok.pubkey(), token_mint.pubkey());

    // Second deposit by same player should fail
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager {
            depositor: player_a.pubkey(), match_state: match_pda,
            depositor_token_account: pa_tok.pubkey(), vault: vault_pda,
            token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &player_a, &[&player_a]);
    assert!(res.is_err(), "Double deposit by same player should fail");
}
