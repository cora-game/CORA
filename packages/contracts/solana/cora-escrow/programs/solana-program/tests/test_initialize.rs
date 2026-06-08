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
fn test_initialize_match_happy_path() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [1u8; 32];
    let (match_pda, _vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );
    assert_ne!(match_pda, Pubkey::default());
}

#[test]
fn test_initialize_match_zero_wager_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [2u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);

    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeMatch {
            match_id, wager_amount: 0, server_pubkey: server.pubkey(),
        }.data(),
        solana_program::accounts::InitializeMatch {
            player_a: player_a.pubkey(), player_b: player_b.pubkey(),
            token_mint: token_mint.pubkey(), match_state: match_pda, vault: vault_pda,
            token_program: TOKEN_PROGRAM_ID, system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &player_a, &[&player_a]);
    assert!(res.is_err(), "Zero wager should be rejected");
}

#[test]
fn test_initialize_match_same_player_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [3u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);

    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeMatch {
            match_id, wager_amount: WAGER_AMOUNT, server_pubkey: server.pubkey(),
        }.data(),
        solana_program::accounts::InitializeMatch {
            player_a: player_a.pubkey(), player_b: player_a.pubkey(),
            token_mint: token_mint.pubkey(), match_state: match_pda, vault: vault_pda,
            token_program: TOKEN_PROGRAM_ID, system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &player_a, &[&player_a]);
    assert!(res.is_err(), "Same player as A and B should be rejected");
}

#[test]
fn test_initialize_match_below_min_wager_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [4u8; 32];
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);

    // Wager = 1 (below MIN_WAGER = 10_000)
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeMatch {
            match_id, wager_amount: 1, server_pubkey: server.pubkey(),
        }.data(),
        solana_program::accounts::InitializeMatch {
            player_a: player_a.pubkey(), player_b: player_b.pubkey(),
            token_mint: token_mint.pubkey(), match_state: match_pda, vault: vault_pda,
            token_program: TOKEN_PROGRAM_ID, system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &player_a, &[&player_a]);
    assert!(res.is_err(), "Wager below MIN_WAGER should be rejected");
}
