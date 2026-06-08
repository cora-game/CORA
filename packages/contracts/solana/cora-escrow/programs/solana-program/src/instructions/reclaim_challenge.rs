use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::error::CoraError;
use crate::events::ChallengeReclaimedEvent;
use crate::state::OpenChallengeState;

pub fn handler(ctx: Context<ReclaimChallenge>) -> Result<()> {
    require!(
        Clock::get()?.unix_timestamp >= ctx.accounts.challenge_state.expires_at,
        CoraError::ChallengeNotExpired
    );

    let match_id = ctx.accounts.challenge_state.match_id;
    let wager_amount = ctx.accounts.challenge_state.wager_amount;
    let bump = ctx.accounts.challenge_state.bump;
    let decimals = ctx.accounts.token_mint.decimals;
    let challenge_state_info = ctx.accounts.challenge_state.to_account_info();
    let signer: &[&[&[u8]]] = &[&[CHALLENGE_SEED, match_id.as_ref(), &[bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.challenge_vault.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: challenge_state_info.clone(),
            },
            signer,
        ),
        wager_amount,
        decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.challenge_vault.to_account_info(),
            destination: ctx.accounts.creator.to_account_info(),
            authority: challenge_state_info,
        },
        signer,
    ))?;

    emit!(ChallengeReclaimedEvent {
        match_id,
        creator: ctx.accounts.creator.key(),
        refunded_amount: wager_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ReclaimChallenge<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, challenge_state.match_id.as_ref()],
        bump = challenge_state.bump,
        constraint = challenge_state.creator == creator.key()
            @ CoraError::UnauthorizedPlayer,
        close = creator
    )]
    pub challenge_state: Account<'info, OpenChallengeState>,

    #[account(
        mut,
        seeds = [CHALLENGE_VAULT_SEED, challenge_state.match_id.as_ref()],
        bump = challenge_state.vault_bump,
        token::mint = token_mint,
        token::authority = challenge_state,
    )]
    pub challenge_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = creator,
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}
