use crate::constants::*;
use crate::error::BattleError;
use crate::events::SessionCancelledEvent;
use crate::state::{BattleSession, BattleStatus};
use anchor_lang::prelude::*;

/// Force-end a stale or timed-out session.
/// Only callable by the session authority after SESSION_TIMEOUT has elapsed.
/// This prevents SOL from being locked in abandoned sessions.
pub fn handler(ctx: Context<ForceEnd>) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    // Cannot force-end already terminal states
    require!(
        session.status == BattleStatus::WaitingCards || session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    // Verify timeout has elapsed
    let now = Clock::get()?.unix_timestamp;
    require!(
        now.saturating_sub(session.created_at) > SESSION_TIMEOUT,
        BattleError::TimeoutNotReached
    );

    session.status = BattleStatus::Cancelled;
    session.winner = Pubkey::default();
    session.finished_at = now;
    session.end_reason = END_REASON_FORCE_ENDED;

    emit!(SessionCancelledEvent {
        session: session.key(),
        match_id: session.match_id,
        reason: END_REASON_FORCE_ENDED,
        finished_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ForceEnd<'info> {
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
