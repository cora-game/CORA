use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::EffectAppliedEvent;
use crate::instructions::match_updates::award_round_and_progress;
use crate::state::{BattleSession, BattleStatus};

pub fn handler(
    ctx: Context<ApplyEffect>,
    slot: u8,
    actor_is_a: bool,
    final_value: u16,
    score_delta: u32,
) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let session_key = session.key();

    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now.saturating_sub(session.created_at) <= SESSION_TIMEOUT,
        BattleError::SessionExpired
    );
    require!(now < session.round_deadline, BattleError::RoundDeadlinePassed);

    let total_slots = if actor_is_a {
        session.total_slots_a
    } else {
        session.total_slots_b
    };
    let used_bitmask_value = if actor_is_a {
        session.cards_used_a
    } else {
        session.cards_used_b
    };
    let actor = if actor_is_a {
        session.player_a
    } else {
        session.player_b
    };

    require!(slot < total_slots, BattleError::SlotOutOfBounds);

    let bit = 1u128
        .checked_shl(u32::from(slot))
        .ok_or(BattleError::SlotOutOfBounds)?;
    require!((used_bitmask_value & bit) == 0, BattleError::CardAlreadyUsed);

    let offset = usize::from(slot) * MANIFEST_ENTRY_SIZE;
    let (effect_type, max_value) = if actor_is_a {
        (
            session.card_manifest_a[offset],
            u16::from_le_bytes([
                session.card_manifest_a[offset + 1],
                session.card_manifest_a[offset + 2],
            ]),
        )
    } else {
        (
            session.card_manifest_b[offset],
            u16::from_le_bytes([
                session.card_manifest_b[offset + 1],
                session.card_manifest_b[offset + 2],
            ]),
        )
    };

    require!(
        effect_type == EFFECT_ATTACK
            || effect_type == EFFECT_HEAL
            || effect_type == EFFECT_NONE,
        BattleError::InvalidEffectType
    );
    require!(final_value <= max_value, BattleError::InvalidEffectValue);
    require!(
        final_value <= max_effect_value_for_type(effect_type),
        BattleError::InvalidEffectValue
    );

    match effect_type {
        EFFECT_ATTACK | EFFECT_HEAL => {
            require!(
                final_value == 0 || final_value >= MIN_DAMAGE,
                BattleError::InvalidEffectValue
            );
        }
        EFFECT_NONE => {
            require!(final_value == 0, BattleError::InvalidEffectValue);
        }
        _ => return err!(BattleError::InvalidEffectType),
    }

    let max_score_delta = u32::from(final_value)
        .checked_mul(MAX_SCORE_MULTIPLIER)
        .ok_or(BattleError::ArithmeticOverflow)?;
    require!(
        score_delta <= max_score_delta,
        BattleError::ScoreDeltaExceedsMultiplier
    );

    let actual_damage = if effect_type == EFFECT_ATTACK {
        if actor_is_a {
            session.health_b.min(final_value)
        } else {
            session.health_a.min(final_value)
        }
    } else {
        0
    };

    match effect_type {
        EFFECT_ATTACK => {
            if actor_is_a {
                session.health_b = session.health_b.saturating_sub(final_value);
                session.round_damage_a = session
                    .round_damage_a
                    .checked_add(u32::from(actual_damage))
                    .ok_or(BattleError::ArithmeticOverflow)?;
            } else {
                session.health_a = session.health_a.saturating_sub(final_value);
                session.round_damage_b = session
                    .round_damage_b
                    .checked_add(u32::from(actual_damage))
                    .ok_or(BattleError::ArithmeticOverflow)?;
            }
        }
        EFFECT_HEAL => {
            if actor_is_a {
                session.health_a = session
                    .health_a
                    .saturating_add(final_value)
                    .min(INITIAL_HEALTH);
            } else {
                session.health_b = session
                    .health_b
                    .saturating_add(final_value)
                    .min(INITIAL_HEALTH);
            }
        }
        EFFECT_NONE => {}
        _ => return err!(BattleError::InvalidEffectType),
    }

    if actor_is_a {
        session.game_score_a = session
            .game_score_a
            .checked_add(score_delta)
            .ok_or(BattleError::ArithmeticOverflow)?;
    } else {
        session.game_score_b = session
            .game_score_b
            .checked_add(score_delta)
            .ok_or(BattleError::ArithmeticOverflow)?;
    }

    if actor_is_a {
        session.cards_used_a |= bit;
    } else {
        session.cards_used_b |= bit;
    }
    session.total_plays = session
        .total_plays
        .checked_add(1)
        .ok_or(BattleError::ArithmeticOverflow)?;

    emit!(EffectAppliedEvent {
        session: session_key,
        actor,
        actor_is_a,
        slot,
        effect_type,
        max_value,
        final_value,
        score_delta,
        health_a: session.health_a,
        health_b: session.health_b,
        score_a: session.score_a,
        score_b: session.score_b,
        game_score_a: session.game_score_a,
        game_score_b: session.game_score_b,
        current_round: session.current_round,
    });

    if effect_type == EFFECT_ATTACK
        && final_value > 0
        && (session.health_a == 0 || session.health_b == 0)
    {
        let round_winner_is_a = if session.health_a == 0 && session.health_b == 0 {
            actor_is_a
        } else {
            session.health_b == 0
        };
        award_round_and_progress(
            session,
            session_key,
            round_winner_is_a,
            END_REASON_NORMAL_WIN,
            now,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ApplyEffect<'info> {
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
