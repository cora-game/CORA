use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::CardEffectAppliedEvent;
use crate::instructions::match_updates::award_round_and_progress;
use crate::state::{BattleSession, BattleStatus, RegisteredCard};

/// Apply a backend-authorized card effect to ER state.
pub fn handler(ctx: Context<ApplyCardEffect>, final_value: u16, score_delta: u32) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let card = &mut ctx.accounts.registered_card;
    let session_key = session.key();
    let card_key = card.key();

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

    require!(!card.is_used, BattleError::CardAlreadyUsed);
    require!(
        card.session == session_key,
        BattleError::UnregisteredCard
    );
    require!(
        card.owner == session.player_a || card.owner == session.player_b,
        BattleError::InvalidCardOwner
    );
    require!(
        card.effect_type == EFFECT_ATTACK
            || card.effect_type == EFFECT_HEAL
            || card.effect_type == EFFECT_NONE,
        BattleError::InvalidEffectType
    );
    require!(final_value <= card.max_value, BattleError::InvalidEffectValue);
    require!(
        final_value <= max_effect_value_for_type(card.effect_type),
        BattleError::InvalidEffectValue
    );
    require!(score_delta <= MAX_SCORE_DELTA, BattleError::InvalidScoreDelta);

    if card.effect_type == EFFECT_ATTACK || card.effect_type == EFFECT_HEAL {
        require!(final_value >= MIN_DAMAGE, BattleError::InvalidEffectValue);
    } else {
        require!(final_value == 0, BattleError::InvalidEffectValue);
    }

    let actor_is_a = card.owner == session.player_a;
    let actual_damage = if card.effect_type == EFFECT_ATTACK {
        if actor_is_a {
            session.health_b.min(final_value)
        } else {
            session.health_a.min(final_value)
        }
    } else {
        0
    };

    match card.effect_type {
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
                session.health_a = session.health_a.saturating_add(final_value).min(INITIAL_HEALTH);
            } else {
                session.health_b = session.health_b.saturating_add(final_value).min(INITIAL_HEALTH);
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

    card.is_used = true;
    session.total_plays = session
        .total_plays
        .checked_add(1)
        .ok_or(BattleError::ArithmeticOverflow)?;

    emit!(CardEffectAppliedEvent {
        session: session_key,
        card: card_key,
        actor: card.owner,
        effect_type: card.effect_type,
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

    if card.effect_type == EFFECT_ATTACK && (session.health_a == 0 || session.health_b == 0) {
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
pub struct ApplyCardEffect<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
    #[account(
        mut,
        seeds = [
            CARD_SEED,
            battle_session.key().as_ref(),
            registered_card.card_id.as_ref(),
        ],
        bump = registered_card.bump,
        constraint = registered_card.session == battle_session.key()
            @ BattleError::UnregisteredCard,
    )]
    pub registered_card: Box<Account<'info, RegisteredCard>>,
}
