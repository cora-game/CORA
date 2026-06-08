use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::SessionCancelledEvent;
use crate::state::{BattleSession, BattleStatus};

/// Authority-controlled no-contest cancellation.
pub fn handler(ctx: Context<CancelSession>, reason: u8) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    require!(
        reason == END_REASON_BOTH_PLAYERS_TIMEOUT
            || reason == END_REASON_SERVER_CANCELLED,
        BattleError::InvalidEndReason
    );

    require!(
        session.status == BattleStatus::WaitingCards || session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    session.status = BattleStatus::Cancelled;
    session.winner = Pubkey::default();
    session.end_reason = reason;
    session.finished_at = now;

    emit!(SessionCancelledEvent {
        session: session.key(),
        match_id: session.match_id,
        reason,
        finished_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelSession<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
}
