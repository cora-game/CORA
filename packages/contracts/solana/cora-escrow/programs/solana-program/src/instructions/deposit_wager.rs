use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface,
    TransferChecked, transfer_checked,
};
use crate::constants::*;
use crate::error::CoraError;
use crate::events::WagerDepositedEvent;
use crate::state::{MatchState, MatchStatus};

pub fn handler(ctx: Context<DepositWager>) -> Result<()> {
    let match_state = &mut ctx.accounts.match_state;
    let depositor = ctx.accounts.depositor.key();
    let now = Clock::get()?.unix_timestamp;

    require!(
        match_state.status == MatchStatus::WaitingDeposit,
        CoraError::NotWaitingDeposit
    );

    let is_player_a = depositor == match_state.player_a;
    let is_player_b = depositor == match_state.player_b;
    require!(is_player_a || is_player_b, CoraError::UnauthorizedPlayer);

    if is_player_a {
        require!(!match_state.player_a_deposited, CoraError::AlreadyDeposited);
    } else {
        require!(!match_state.player_b_deposited, CoraError::AlreadyDeposited);
    }

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        TransferChecked {
            from:      ctx.accounts.depositor_token_account.to_account_info(),
            mint:      ctx.accounts.token_mint.to_account_info(),
            to:        ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    transfer_checked(cpi_ctx, match_state.wager_amount, ctx.accounts.token_mint.decimals)?;

    if is_player_a {
        match_state.player_a_deposited = true;
        msg!("Player A deposited: {}", match_state.wager_amount);
    } else {
        match_state.player_b_deposited = true;
        msg!("Player B deposited: {}", match_state.wager_amount);
    }

    if match_state.player_a_deposited && match_state.player_b_deposited {
        match_state.status = MatchStatus::Active;
        match_state.active_at = now;
        msg!("Both players deposited. Match is now ACTIVE!");
    }

    emit!(WagerDepositedEvent {
        match_id: match_state.match_id,
        depositor,
        amount: match_state.wager_amount,
        match_active: match_state.status == MatchStatus::Active,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DepositWager<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [MATCH_SEED, match_state.match_id.as_ref()],
        bump = match_state.bump,
        constraint = match_state.token_mint == token_mint.key() @ CoraError::InvalidTokenMint,
    )]
    pub match_state: Account<'info, MatchState>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = depositor,
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, match_state.match_id.as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}
