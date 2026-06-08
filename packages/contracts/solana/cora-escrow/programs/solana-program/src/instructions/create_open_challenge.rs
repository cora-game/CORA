use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::CoraError;
use crate::events::OpenChallengeCreatedEvent;
use crate::state::OpenChallengeState;

pub fn handler(
    ctx: Context<CreateOpenChallenge>,
    match_id: [u8; 32],
    wager_amount: u64,
    server_pubkey: Pubkey,
) -> Result<()> {
    require!(wager_amount >= MIN_WAGER, CoraError::InvalidWagerAmount);

    let now = Clock::get()?.unix_timestamp;
    let challenge_state = &mut ctx.accounts.challenge_state;
    challenge_state.version = 1;
    challenge_state.match_id = match_id;
    challenge_state.creator = ctx.accounts.creator.key();
    challenge_state.token_mint = ctx.accounts.token_mint.key();
    challenge_state.server_pubkey = server_pubkey;
    challenge_state.wager_amount = wager_amount;
    challenge_state.created_at = now;
    challenge_state.expires_at = now + CHALLENGE_EXPIRY;
    challenge_state.bump = ctx.bumps.challenge_state;
    challenge_state.vault_bump = ctx.bumps.challenge_vault;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.creator_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.challenge_vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        wager_amount,
        ctx.accounts.token_mint.decimals,
    )?;

    emit!(OpenChallengeCreatedEvent {
        match_id,
        creator: challenge_state.creator,
        token_mint: challenge_state.token_mint,
        wager_amount,
        expires_at: challenge_state.expires_at,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct CreateOpenChallenge<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = OpenChallengeState::LEN,
        seeds = [CHALLENGE_SEED, match_id.as_ref()],
        bump
    )]
    pub challenge_state: Account<'info, OpenChallengeState>,

    #[account(
        init,
        payer = creator,
        token::mint = token_mint,
        token::authority = challenge_state,
        token::token_program = token_program,
        seeds = [CHALLENGE_VAULT_SEED, match_id.as_ref()],
        bump
    )]
    pub challenge_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = creator,
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
