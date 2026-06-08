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
fn test_initialize_config_happy_path() {
    let (mut svm, pid) = setup();
    let admin = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();

    let config_pda = do_init_config(&mut svm, pid, &admin, treasury.pubkey());
    assert_ne!(config_pda, Pubkey::default());
}

#[test]
fn test_initialize_config_duplicate_fails() {
    let (mut svm, pid) = setup();
    let admin = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();

    do_init_config(&mut svm, pid, &admin, treasury.pubkey());

    // Second init should fail (PDA already exists)
    let (config_pda, _) = find_config_pda(&pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeConfig { treasury_authority: treasury.pubkey() }.data(),
        solana_program::accounts::InitializeConfig {
            admin: admin.pubkey(), config: config_pda, system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert!(res.is_err(), "Duplicate config init should fail");
}

#[test]
fn test_update_config_happy_path() {
    let (mut svm, pid) = setup();
    let admin = Keypair::new();
    let old_treasury = Keypair::new();
    let new_treasury = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();

    let config_pda = do_init_config(&mut svm, pid, &admin, old_treasury.pubkey());

    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::UpdateConfig { new_treasury_authority: new_treasury.pubkey() }.data(),
        solana_program::accounts::UpdateConfig {
            admin: admin.pubkey(), config: config_pda,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &admin, &[&admin]);
    assert!(res.is_ok(), "Admin should update config: {:?}", res.err());
}

#[test]
fn test_update_config_unauthorized_fails() {
    let (mut svm, pid) = setup();
    let admin = Keypair::new();
    let attacker = Keypair::new();
    let treasury = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&attacker.pubkey(), 10_000_000_000).unwrap();

    let config_pda = do_init_config(&mut svm, pid, &admin, treasury.pubkey());

    // Attacker tries to update config
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::UpdateConfig { new_treasury_authority: attacker.pubkey() }.data(),
        solana_program::accounts::UpdateConfig {
            admin: attacker.pubkey(), config: config_pda,
        }.to_account_metas(None),
    );
    let res = send_tx(&mut svm, &[ix], &attacker, &[&attacker]);
    assert!(res.is_err(), "Non-admin should not update config");
}
