#![allow(dead_code)]

use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_pubkey::Pubkey,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const TOKEN_PROGRAM_ID: Pubkey = solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const INSTRUCTIONS_SYSVAR_ID: Pubkey = solana_pubkey::pubkey!("Sysvar1nstructions1111111111111111111111111");
pub const MINT_ACCOUNT_LEN: usize = 82;
pub const TOKEN_ACCOUNT_LEN: usize = 165;
pub const WAGER_AMOUNT: u64 = 1_000_000;

pub fn create_mint_account(svm: &mut LiteSVM, mint_kp: &Keypair, authority: &Pubkey, decimals: u8) {
    let mut data = vec![0u8; MINT_ACCOUNT_LEN];
    data[0..4].copy_from_slice(&1u32.to_le_bytes());
    data[4..36].copy_from_slice(authority.as_ref());
    data[36..44].copy_from_slice(&0u64.to_le_bytes());
    data[44] = decimals;
    data[45] = 1;
    data[46..50].copy_from_slice(&0u32.to_le_bytes());
    let rent = svm.minimum_balance_for_rent_exemption(MINT_ACCOUNT_LEN);
    svm.set_account(mint_kp.pubkey(), Account {
        lamports: rent, data, owner: TOKEN_PROGRAM_ID, executable: false, rent_epoch: 0,
    }).unwrap();
}

pub fn create_token_account(svm: &mut LiteSVM, addr: &Pubkey, mint: &Pubkey, owner: &Pubkey, amount: u64) {
    let mut data = vec![0u8; TOKEN_ACCOUNT_LEN];
    data[0..32].copy_from_slice(mint.as_ref());
    data[32..64].copy_from_slice(owner.as_ref());
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    data[72..76].copy_from_slice(&0u32.to_le_bytes());
    data[108] = 1;
    let rent = svm.minimum_balance_for_rent_exemption(TOKEN_ACCOUNT_LEN);
    svm.set_account(*addr, Account {
        lamports: rent, data, owner: TOKEN_PROGRAM_ID, executable: false, rent_epoch: 0,
    }).unwrap();
}

pub fn get_token_balance(svm: &mut LiteSVM, addr: &Pubkey) -> u64 {
    let acc = svm.get_account(addr).unwrap();
    u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
}

pub fn find_match_pda(match_id: &[u8; 32], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"match", match_id.as_ref()], pid)
}

pub fn find_vault_pda(match_id: &[u8; 32], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", match_id.as_ref()], pid)
}

pub fn find_challenge_pda(match_id: &[u8; 32], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"challenge", match_id.as_ref()], pid)
}

pub fn find_challenge_vault_pda(match_id: &[u8; 32], pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"challenge_vault", match_id.as_ref()], pid)
}

pub fn find_config_pda(pid: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], pid)
}

pub fn get_lamports(svm: &mut LiteSVM, addr: &Pubkey) -> u64 {
    svm.get_account(addr).unwrap().lamports
}

pub fn get_anchor_account<T: AccountDeserialize>(svm: &mut LiteSVM, addr: &Pubkey) -> T {
    let account = svm.get_account(addr).unwrap();
    let mut data: &[u8] = &account.data;
    T::try_deserialize(&mut data).unwrap()
}

pub fn send_tx(
    svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair],
) -> Result<(), String> {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e))
}

pub fn do_init_config(svm: &mut LiteSVM, pid: Pubkey, admin: &Keypair, treasury_auth: Pubkey) -> Pubkey {
    let (config_pda, _) = find_config_pda(&pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeConfig { treasury_authority: treasury_auth }.data(),
        solana_program::accounts::InitializeConfig {
            admin: admin.pubkey(), config: config_pda, system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], admin, &[admin]).unwrap();
    config_pda
}

pub fn do_init_match(
    svm: &mut LiteSVM, pid: Pubkey, player_a: &Keypair, player_b_pk: Pubkey,
    server_pk: Pubkey, mint_pk: Pubkey, match_id: [u8; 32], wager: u64,
) -> (Pubkey, Pubkey) {
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::InitializeMatch { match_id, wager_amount: wager, server_pubkey: server_pk }.data(),
        solana_program::accounts::InitializeMatch {
            player_a: player_a.pubkey(), player_b: player_b_pk, token_mint: mint_pk,
            match_state: match_pda, vault: vault_pda, token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], player_a, &[player_a]).unwrap();
    (match_pda, vault_pda)
}

pub fn do_deposit(
    svm: &mut LiteSVM, pid: Pubkey, depositor: &Keypair,
    match_pda: Pubkey, vault_pda: Pubkey, depositor_token: Pubkey, mint_pk: Pubkey,
) {
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::DepositWager {}.data(),
        solana_program::accounts::DepositWager {
            depositor: depositor.pubkey(), match_state: match_pda,
            depositor_token_account: depositor_token, vault: vault_pda,
            token_mint: mint_pk, token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], depositor, &[depositor]).unwrap();
}

pub fn do_create_open_challenge(
    svm: &mut LiteSVM, pid: Pubkey, creator: &Keypair,
    creator_token: Pubkey, token_mint: Pubkey, match_id: [u8; 32], wager: u64,
    server_pk: Pubkey,
) -> (Pubkey, Pubkey) {
    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::CreateOpenChallenge {
            match_id,
            wager_amount: wager,
            server_pubkey: server_pk,
        }.data(),
        solana_program::accounts::CreateOpenChallenge {
            creator: creator.pubkey(),
            token_mint,
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            creator_token_account: creator_token,
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], creator, &[creator]).unwrap();
    (challenge_pda, challenge_vault_pda)
}

pub fn do_accept_challenge(
    svm: &mut LiteSVM, pid: Pubkey, challenger: &Keypair, creator_pk: Pubkey,
    challenger_token: Pubkey, token_mint: Pubkey, match_id: [u8; 32],
) -> (Pubkey, Pubkey) {
    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let (match_pda, _) = find_match_pda(&match_id, &pid);
    let (vault_pda, _) = find_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::AcceptChallenge { match_id }.data(),
        solana_program::accounts::AcceptChallenge {
            challenger: challenger.pubkey(),
            creator: creator_pk,
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            token_mint,
            match_state: match_pda,
            vault: vault_pda,
            challenger_token_account: challenger_token,
            token_program: TOKEN_PROGRAM_ID,
            system_program: Pubkey::default(),
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], challenger, &[challenger]).unwrap();
    (match_pda, vault_pda)
}

pub fn do_reclaim_challenge(
    svm: &mut LiteSVM, pid: Pubkey, creator: &Keypair,
    creator_token: Pubkey, token_mint: Pubkey, match_id: [u8; 32],
) {
    let (challenge_pda, _) = find_challenge_pda(&match_id, &pid);
    let (challenge_vault_pda, _) = find_challenge_vault_pda(&match_id, &pid);
    let ix = Instruction::new_with_bytes(
        pid,
        &solana_program::instruction::ReclaimChallenge {}.data(),
        solana_program::accounts::ReclaimChallenge {
            creator: creator.pubkey(),
            challenge_state: challenge_pda,
            challenge_vault: challenge_vault_pda,
            creator_token_account: creator_token,
            token_mint,
            token_program: TOKEN_PROGRAM_ID,
        }.to_account_metas(None),
    );
    send_tx(svm, &[ix], creator, &[creator]).unwrap();
}

/// Full match setup: init + both deposits → Active state
pub struct ActiveMatch {
    pub match_pda: Pubkey,
    pub vault_pda: Pubkey,
    pub config_pda: Pubkey,
    pub player_a_token: Pubkey,
    pub player_b_token: Pubkey,
    pub treasury_token: Pubkey,
}

pub fn setup_active_match(
    svm: &mut LiteSVM, pid: Pubkey, player_a: &Keypair, player_b: &Keypair,
    server: &Keypair, token_mint: &Keypair, treasury_kp: &Keypair,
    match_id: [u8; 32],
) -> ActiveMatch {
    let config_pda = do_init_config(svm, pid, server, treasury_kp.pubkey());
    create_mint_account(svm, token_mint, &player_a.pubkey(), 6);
    let (match_pda, vault_pda) = do_init_match(
        svm, pid, player_a, player_b.pubkey(), server.pubkey(), token_mint.pubkey(), match_id, WAGER_AMOUNT,
    );
    let pa_tok = Keypair::new();
    let pb_tok = Keypair::new();
    let tr_tok = Keypair::new();
    create_token_account(svm, &pa_tok.pubkey(), &token_mint.pubkey(), &player_a.pubkey(), 5_000_000);
    create_token_account(svm, &pb_tok.pubkey(), &token_mint.pubkey(), &player_b.pubkey(), 5_000_000);
    create_token_account(svm, &tr_tok.pubkey(), &token_mint.pubkey(), &treasury_kp.pubkey(), 0);
    do_deposit(svm, pid, player_a, match_pda, vault_pda, pa_tok.pubkey(), token_mint.pubkey());
    do_deposit(svm, pid, player_b, match_pda, vault_pda, pb_tok.pubkey(), token_mint.pubkey());
    ActiveMatch {
        match_pda, vault_pda, config_pda,
        player_a_token: pa_tok.pubkey(),
        player_b_token: pb_tok.pubkey(),
        treasury_token: tr_tok.pubkey(),
    }
}
