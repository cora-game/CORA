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

fn build_refund_ix(
    pid: Pubkey, caller: Pubkey, match_pda: Pubkey, vault_pda: Pubkey,
    pa_tok: Pubkey, pb_tok: Pubkey, mint_pk: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::Refund {}.data(),
        solana_program::accounts::Refund {
            caller, match_state: match_pda, vault: vault_pda,
            player_a_token_account: pa_tok, player_b_token_account: pb_tok,
            token_mint: mint_pk, token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    )
}

#[test]
fn test_refund_waiting_deposit_timeout() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [30u8; 32];
    let (match_pda, vault_pda) = do_init_match(
        &mut svm, pid, &player_a, player_b.pubkey(),
        server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );

    let pa_tok = Keypair::new();
    let pb_tok = Keypair::new();
    create_token_account(&mut svm, &pa_tok.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    create_token_account(&mut svm, &pb_tok.pubkey(), &token_mint.pubkey(), &player_b.pubkey(), 5_000_000);

    // Player A deposits
    do_deposit(&mut svm, pid, &player_a, match_pda, vault_pda, pa_tok.pubkey(), token_mint.pubkey());

    let refund_ix = build_refund_ix(
        pid, player_a.pubkey(), match_pda, vault_pda,
        pa_tok.pubkey(), pb_tok.pubkey(), token_mint.pubkey(),
    );

    // Before timeout — should fail
    let res = send_tx(&mut svm, &[refund_ix.clone()], &player_a, &[&player_a]);
    assert!(res.is_err(), "Refund before timeout should fail");

    // Advance clock past DEPOSIT_TIMEOUT (30s)
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 35;
    svm.set_sysvar(&clock);

    // After timeout — should succeed (use player_b as payer to change tx signature)
    let res = send_tx(&mut svm, &[refund_ix], &player_b, &[&player_b, &player_a]);
    assert!(res.is_ok(), "Refund after timeout should succeed: {:?}", res.err());
    assert_eq!(get_token_balance(&mut svm, &pa_tok.pubkey()), 5_000_000, "Player A gets full refund");

    // Verify accounts are closed
    assert!(svm.get_account(&match_pda).is_none(), "match_state should be closed");
    assert!(svm.get_account(&vault_pda).is_none(), "vault should be closed");
}

#[test]
fn test_refund_active_match_timeout() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    create_mint_account(&mut svm, &token_mint, &player_a.pubkey(), 6);

    let match_id: [u8; 32] = [31u8; 32];
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

    // Advance clock past MATCH_TIMEOUT (900s)
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 910;
    svm.set_sysvar(&clock);

    let refund_ix = build_refund_ix(
        pid, player_a.pubkey(), match_pda, vault_pda,
        pa_tok.pubkey(), pb_tok.pubkey(), token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &[refund_ix], &player_a, &[&player_a]);
    assert!(res.is_ok(), "Refund after match timeout should succeed: {:?}", res.err());
    assert_eq!(get_token_balance(&mut svm, &pa_tok.pubkey()), 5_000_000);
    assert_eq!(get_token_balance(&mut svm, &pb_tok.pubkey()), 5_000_000);

    // Verify accounts are closed
    assert!(svm.get_account(&match_pda).is_none(), "match_state should be closed");
    assert!(svm.get_account(&vault_pda).is_none(), "vault should be closed");
}

#[test]
fn test_refund_after_settled_fails() {
    let (mut svm, pid) = setup();
    let player_a = Keypair::new();
    let player_b = Keypair::new();
    let server = Keypair::new();
    let token_mint = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&player_a.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&player_b.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&server.pubkey(), 10_000_000_000).unwrap();

    let match_id: [u8; 32] = [32u8; 32];
    let am = setup_active_match(&mut svm, pid, &player_a, &player_b, &server, &token_mint, &treasury, match_id);

    // Settle the match first
    let mut message = [0u8; 65];
    message[0] = 0;
    message[1..33].copy_from_slice(&match_id);
    message[33..65].copy_from_slice(&player_a.pubkey().to_bytes());
    let signature = server.sign_message(&message);
    let sig_bytes: [u8; 64] = signature.into();

    let ed25519_ix = new_ed25519_instruction_with_signature(
        &message, &sig_bytes, &server.pubkey().to_bytes(),
    );
    let settle_ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::SettleMatch { action: 0, target: player_a.pubkey(), signature: sig_bytes }.data(),
        solana_program::accounts::SettleMatch {
            caller: server.pubkey(), match_state: am.match_pda, vault: am.vault_pda,
            player_a_token_account: am.player_a_token, player_b_token_account: am.player_b_token,
            config: am.config_pda, treasury: am.treasury_token,
            token_mint: token_mint.pubkey(), token_program: TOKEN_PROGRAM_ID,
            instructions_sysvar: INSTRUCTIONS_SYSVAR_ID,
        }.to_account_metas(None),
    );
    send_tx(&mut svm, &[ed25519_ix, settle_ix], &server, &[&server]).unwrap();

    // Advance clock and try to refund — should fail (already settled)
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 910;
    svm.set_sysvar(&clock);

    let refund_ix = build_refund_ix(
        pid, player_a.pubkey(), am.match_pda, am.vault_pda,
        am.player_a_token, am.player_b_token, token_mint.pubkey(),
    );
    let res = send_tx(&mut svm, &[refund_ix], &player_a, &[&player_a]);
    assert!(res.is_err(), "Refund after settlement should fail");
}
