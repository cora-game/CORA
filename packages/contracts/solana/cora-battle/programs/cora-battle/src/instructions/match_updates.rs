use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::{
    BattleFinalizedEvent, RoundAdvancedEvent, RoundEndedEvent, SessionCancelledEvent,
};
use crate::state::{BattleSession, BattleStatus};

pub(crate) fn finalize_with_winner(
    session: &mut BattleSession,
    session_key: Pubkey,
    winner: Pubkey,
    end_reason: u8,
    now: i64,
) {
    session.status = BattleStatus::Finished;
    session.winner = winner;
    session.finished_at = now;
    session.end_reason = end_reason;

    emit!(BattleFinalizedEvent {
        session: session_key,
        match_id: session.match_id,
        winner,
        end_reason: session.end_reason,
        score_a: session.score_a,
        score_b: session.score_b,
        rounds_won_a: session.rounds_won_a,
        rounds_won_b: session.rounds_won_b,
        health_a: session.health_a,
        health_b: session.health_b,
        game_score_a: session.game_score_a,
        game_score_b: session.game_score_b,
    });
}

pub(crate) fn cancel_draw_no_contest(
    session: &mut BattleSession,
    session_key: Pubkey,
    now: i64,
) {
    session.status = BattleStatus::Cancelled;
    session.winner = Pubkey::default();
    session.finished_at = now;
    session.end_reason = END_REASON_DRAW_NO_CONTEST;

    emit!(SessionCancelledEvent {
        session: session_key,
        match_id: session.match_id,
        reason: END_REASON_DRAW_NO_CONTEST,
        finished_at: now,
    });
}

pub(crate) fn advance_round(
    session: &mut BattleSession,
    session_key: Pubkey,
    now: i64,
) -> Result<()> {
    session.health_a = INITIAL_HEALTH;
    session.health_b = INITIAL_HEALTH;
    session.round_damage_a = 0;
    session.round_damage_b = 0;
    session.current_round = session
        .current_round
        .checked_add(1)
        .ok_or(BattleError::ArithmeticOverflow)?;
    session.round_started_at = now;
    session.round_deadline = now
        .checked_add(ROUND_DURATION_SECONDS)
        .ok_or(BattleError::ArithmeticOverflow)?;

    emit!(RoundAdvancedEvent {
        session: session_key,
        match_id: session.match_id,
        current_round: session.current_round,
        round_deadline: session.round_deadline,
    });

    Ok(())
}

pub(crate) fn finalize_by_match_rules_or_cancel(
    session: &mut BattleSession,
    session_key: Pubkey,
    end_reason: u8,
    now: i64,
) {
    if let Some(winner) = session.determine_winner_by_match_rules() {
        finalize_with_winner(session, session_key, winner, end_reason, now);
    } else {
        cancel_draw_no_contest(session, session_key, now);
    }
}

/// Apply the standard non-timeout round winner flow used by normal card effects:
/// sync legacy round counters, emit round end, and either finalize or advance.
pub(crate) fn award_round_and_progress(
    session: &mut BattleSession,
    session_key: Pubkey,
    round_winner_is_a: bool,
    finish_end_reason: u8,
    now: i64,
) -> Result<()> {
    if round_winner_is_a {
        session.score_a = session
            .score_a
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        // TODO: rounds_won_* is a legacy duplicate of score_* and should be
        // removed in a future account migration once downstream consumers move.
        session.rounds_won_a = session
            .rounds_won_a
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
    } else {
        session.score_b = session
            .score_b
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
        // TODO: rounds_won_* is a legacy duplicate of score_* and should be
        // removed in a future account migration once downstream consumers move.
        session.rounds_won_b = session
            .rounds_won_b
            .checked_add(1)
            .ok_or(BattleError::ArithmeticOverflow)?;
    }

    let round_winner = if round_winner_is_a {
        session.player_a
    } else {
        session.player_b
    };

    emit!(RoundEndedEvent {
        session: session_key,
        match_id: session.match_id,
        round: session.current_round,
        round_winner,
        rounds_won_a: session.rounds_won_a,
        rounds_won_b: session.rounds_won_b,
    });

    let max_rounds_reached = session.current_round >= MAX_ROUNDS;
    if session.score_a >= u16::from(ROUNDS_TO_WIN)
        || session.score_b >= u16::from(ROUNDS_TO_WIN)
        || max_rounds_reached
    {
        finalize_by_match_rules_or_cancel(session, session_key, finish_end_reason, now);
    } else {
        advance_round(session, session_key, now)?;
    }

    Ok(())
}
