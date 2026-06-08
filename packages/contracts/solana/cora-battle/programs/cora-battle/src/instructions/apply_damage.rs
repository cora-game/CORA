use crate::constants::*;
use crate::error::BattleError;
use crate::events::{
    DamageAppliedEvent,
};
use crate::instructions::match_updates::award_round_and_progress;
use crate::state::{BattleSession, BattleStatus, RegisteredCard};
use anchor_lang::prelude::*;

/// Apply damage to the opponent of the attacker.
pub fn handler(ctx: Context<ApplyDamage>, attacker: Pubkey) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let card = &mut ctx.accounts.registered_card;
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

    require!(!card.is_used, BattleError::CardAlreadyUsed);
    require!(
        card.effect_type == EFFECT_ATTACK,
        BattleError::InvalidEffectType
    );

    let is_player_a = attacker == session.player_a;
    let is_player_b = attacker == session.player_b;
    require!(is_player_a || is_player_b, BattleError::InvalidTarget);

    card.is_used = true;

    let damage = card.damage;
    let actual_damage = if is_player_a {
        session.health_b.min(damage)
    } else {
        session.health_a.min(damage)
    };
    if is_player_a {
        session.health_b = session.health_b.saturating_sub(damage);
        session.round_damage_a = session
            .round_damage_a
            .checked_add(u32::from(actual_damage))
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.game_score_a = session
            .game_score_a
            .checked_add(u32::from(actual_damage))
            .ok_or(BattleError::ArithmeticOverflow)?;
    } else {
        session.health_a = session.health_a.saturating_sub(damage);
        session.round_damage_b = session
            .round_damage_b
            .checked_add(u32::from(actual_damage))
            .ok_or(BattleError::ArithmeticOverflow)?;
        session.game_score_b = session
            .game_score_b
            .checked_add(u32::from(actual_damage))
            .ok_or(BattleError::ArithmeticOverflow)?;
    }

    session.total_plays = session
        .total_plays
        .checked_add(1)
        .ok_or(BattleError::ArithmeticOverflow)?;

    emit!(DamageAppliedEvent {
        match_id: session.match_id,
        attacker,
        damage,
        health_a: session.health_a,
        health_b: session.health_b,
        round: session.current_round,
    });

    if session.health_a == 0 || session.health_b == 0 {
        let round_winner_is_a = if session.health_a == 0 && session.health_b == 0 {
            is_player_a
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
pub struct ApplyDamage<'info> {
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
