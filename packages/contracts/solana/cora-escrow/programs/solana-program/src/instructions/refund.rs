use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};
use crate::constants::*;
use crate::error::CoraError;
use crate::events::MatchRefundedEvent;
use crate::state::{MatchState, MatchStatus};

pub fn handler(ctx: Context<Refund>) -> Result<()> {
    let match_id = ctx.accounts.match_state.match_id;
    let bump = ctx.accounts.match_state.bump;
    let status = ctx.accounts.match_state.status.clone();
    let created_at = ctx.accounts.match_state.created_at;
    let active_at = ctx.accounts.match_state.active_at;
    let wager_amount = ctx.accounts.match_state.wager_amount;
    let player_a_deposited = ctx.accounts.match_state.player_a_deposited;
    let player_b_deposited = ctx.accounts.match_state.player_b_deposited;
    let decimals = ctx.accounts.token_mint.decimals;

    require!(
        status == MatchStatus::WaitingDeposit || status == MatchStatus::Active,
        CoraError::AlreadyFinalized
    );

    if status == MatchStatus::Active {
        require!(
            player_a_deposited && player_b_deposited,
            CoraError::InvalidRefundState
        );
    }

    let clock = Clock::get()?;
    let elapsed = if status == MatchStatus::Active {
        let start = if active_at > 0 { active_at } else { created_at };
        clock.unix_timestamp - start
    } else {
        clock.unix_timestamp - created_at
    };

    let required_timeout = if status == MatchStatus::Active {
        MATCH_TIMEOUT
    } else {
        DEPOSIT_TIMEOUT
    };

    require!(
        elapsed >= required_timeout,
        CoraError::TimeoutNotReached
    );

    let seeds: &[&[&[u8]]] = &[&[MATCH_SEED, match_id.as_ref(), &[bump]]];
    let match_state_info = ctx.accounts.match_state.to_account_info();

    if player_a_deposited {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        ctx.accounts.player_a_token_account.to_account_info(),
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            wager_amount,
            decimals,
        )?;
        msg!("Refunded player A: {}", wager_amount);
    }

    if player_b_deposited {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        ctx.accounts.player_b_token_account.to_account_info(),
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            wager_amount,
            decimals,
        )?;
        msg!("Refunded player B: {}", wager_amount);
    }

    emit!(MatchRefundedEvent {
        match_id,
    });

    // Close the token vault and return rent to the caller
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.caller.to_account_info(),
            authority: match_state_info,
        },
        seeds,
    ))?;

    msg!("Match refunded after {} seconds. State and vault closed.", elapsed);

    Ok(())
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [MATCH_SEED, match_state.match_id.as_ref()],
        bump = match_state.bump,
        constraint = match_state.token_mint == token_mint.key() @ CoraError::InvalidTokenMint,
        close = caller
    )]
    pub match_state: Box<Account<'info, MatchState>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, match_state.match_id.as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = match_state,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = match_state.player_a,
    )]
    pub player_a_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = match_state.player_b,
    )]
    pub player_b_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}
