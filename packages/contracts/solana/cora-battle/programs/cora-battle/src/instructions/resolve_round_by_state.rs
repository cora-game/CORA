use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::RoundResolvedByStateEvent;
use crate::instructions::match_updates::{
    advance_round, award_round_and_progress, cancel_draw_no_contest,
    finalize_by_match_rules_or_cancel,
};
use crate::state::{BattleSession, BattleStatus};

/// Resolve a timer-expired round from current ER state without any answer data.
/// This is the deterministic public fallback for normal time-up rounds.
pub fn handler(ctx: Context<ResolveRoundByState>) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let session_key = session.key();

    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now >= session.round_deadline, BattleError::TimeoutNotReached);
    require!(
        (1..=MAX_ROUNDS).contains(&session.current_round),
        BattleError::InvalidRoundState
    );

    let resolved_round = session.current_round;
    let health_a = session.health_a;
    let health_b = session.health_b;
    let round_damage_a = session.round_damage_a;
    let round_damage_b = session.round_damage_b;

    let round_winner = if session.health_a > session.health_b {
        Some(session.player_a)
    } else if session.health_b > session.health_a {
        Some(session.player_b)
    } else if session.round_damage_a > session.round_damage_b {
        Some(session.player_a)
    } else if session.round_damage_b > session.round_damage_a {
        Some(session.player_b)
    } else {
        None
    };

    let was_draw = round_winner.is_none();

    match round_winner {
        Some(winner) => {
            let round_winner_is_a = winner == session.player_a;
            award_round_and_progress(
                session,
                session_key,
                round_winner_is_a,
                END_REASON_NORMAL_WIN,
                now,
            )?;
        }
        None => {
            if session.current_round < MAX_ROUNDS {
                advance_round(session, session_key, now)?;
            } else if session.determine_winner_by_match_rules().is_some() {
                finalize_by_match_rules_or_cancel(session, session_key, END_REASON_NORMAL_WIN, now);
            } else {
                cancel_draw_no_contest(session, session_key, now);
            }
        }
    }

    emit!(RoundResolvedByStateEvent {
        session: session_key,
        round: resolved_round,
        resolver: ctx.accounts.authority.key(),
        health_a,
        health_b,
        round_damage_a,
        round_damage_b,
        round_winner: round_winner.unwrap_or_default(),
        score_a: session.score_a,
        score_b: session.score_b,
        game_score_a: session.game_score_a,
        game_score_b: session.game_score_b,
        next_round: if session.status == BattleStatus::Active {
            session.current_round
        } else {
            0
        },
        deadline: if session.status == BattleStatus::Active {
            session.round_deadline
        } else {
            0
        },
        was_draw,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveRoundByState<'info> {
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
