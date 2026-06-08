pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
pub use instructions::{
    AcceptChallenge, CreateOpenChallenge, DepositWager, InitializeConfig, InitializeMatch,
    ReclaimChallenge, Refund, SettleMatch, UpdateConfig,
};
pub(crate) use instructions::{
    __client_accounts_accept_challenge,
    __client_accounts_create_open_challenge,
    __client_accounts_deposit_wager,
    __client_accounts_initialize_config,
    __client_accounts_initialize_match,
    __client_accounts_reclaim_challenge,
    __client_accounts_refund,
    __client_accounts_settle_match,
    __client_accounts_update_config,
};

declare_id!("8h5gHVN29FzmeJSbQXtrvEptxUmDKFag9BQCy3Ky1ZxN");

#[program]
pub mod solana_program {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury_authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, treasury_authority)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_treasury_authority: Pubkey,
    ) -> Result<()> {
        instructions::update_config::handler(ctx, new_treasury_authority)
    }

    pub fn initialize_match(
        ctx: Context<InitializeMatch>,
        match_id: [u8; 32],
        wager_amount: u64,
        server_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::initialize_match::handler(ctx, match_id, wager_amount, server_pubkey)
    }

    pub fn deposit_wager(ctx: Context<DepositWager>) -> Result<()> {
        instructions::deposit_wager::handler(ctx)
    }

    pub fn create_open_challenge(
        ctx: Context<CreateOpenChallenge>,
        match_id: [u8; 32],
        wager_amount: u64,
        server_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::create_open_challenge::handler(ctx, match_id, wager_amount, server_pubkey)
    }

    pub fn accept_challenge(
        ctx: Context<AcceptChallenge>,
        match_id: [u8; 32],
    ) -> Result<()> {
        instructions::accept_challenge::handler(ctx, match_id)
    }

    pub fn reclaim_challenge(ctx: Context<ReclaimChallenge>) -> Result<()> {
        instructions::reclaim_challenge::handler(ctx)
    }

    pub fn settle_match(
        ctx: Context<SettleMatch>,
        action: u8,
        target: Pubkey,
        signature: [u8; 64],
    ) -> Result<()> {
        instructions::settle_match::handler(ctx, action, target, signature)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::handler(ctx)
    }
}
