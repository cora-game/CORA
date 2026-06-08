use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::RoundTimedOutEvent;
use crate::instructions::match_updates::award_round_and_progress;
use crate::state::{BattleSession, BattleStatus};

/// Resolve a missed round after its deadline has passed.
/// The backend decides disconnect/reconnect off-chain; ER only records the
/// terminal round outcome once the round can no longer be resumed.
pub fn handler(ctx: Context<TimeoutPlayerForRound>, timed_out_player: Pubkey) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let session_key = session.key();

    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= session.round_deadline,
        BattleError::TimeoutNotReached
    );

    let timed_out_a = timed_out_player == session.player_a;
    let timed_out_b = timed_out_player == session.player_b;
    require!(timed_out_a || timed_out_b, BattleError::InvalidTarget);

    let resolved_round = session.current_round;
    let round_winner_is_a = if timed_out_a {
        session.player_a_missed_rounds = session
            .player_a_missed_rounds
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        false
    } else {
        session.player_b_missed_rounds = session
            .player_b_missed_rounds
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        true
    };

    let round_winner = if round_winner_is_a {
        session.player_a
    } else {
        session.player_b
    };

    award_round_and_progress(
        session,
        session_key,
        round_winner_is_a,
        END_REASON_SINGLE_PLAYER_TIMEOUT,
        now,
    )?;

    emit!(RoundTimedOutEvent {
        session: session_key,
        match_id: session.match_id,
        timed_out_player,
        round_winner,
        current_round: resolved_round,
        score_a: session.score_a,
        score_b: session.score_b,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TimeoutPlayerForRound<'info> {
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
