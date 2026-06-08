use crate::state::{BattleSession, BattleStatus, RegisteredCard};
use crate::constants::*;
use crate::error::BattleError;
use crate::events::CardRegisteredEvent;
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<RegisterCard>,
    card_id: [u8; 16],
    damage: u16,
) -> Result<()> {
    let session = &ctx.accounts.battle_session;

    // Only allow during card registration phase
    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );

    // Validate damage bounds to prevent one-shot or zero-damage exploits
    require!(
        damage >= MIN_DAMAGE && damage <= MAX_DAMAGE,
        BattleError::InvalidDamage
    );

    let card = &mut ctx.accounts.registered_card;
    // Legacy register_card remains attack-only for apply_damage compatibility.
    // Because the old signature carries no owner, owner is left unset and the
    // new apply_card_effect path should use register_card_v2 instead.
    initialize_card(
        card,
        ctx.accounts.battle_session.key(),
        card_id,
        Pubkey::default(),
        EFFECT_ATTACK,
        damage,
        damage,
        ctx.bumps.registered_card,
    );

    emit!(CardRegisteredEvent {
        session: session.key(),
        card: card.key(),
        match_id: session.match_id,
        card_id,
        owner: card.owner,
        effect_type: card.effect_type,
        max_value: card.max_value,
        damage,
    });

    Ok(())
}

pub fn handler_v2(
    ctx: Context<RegisterCardV2>,
    card_id: [u8; 16],
    owner: Pubkey,
    effect_type: u8,
    max_value: u16,
) -> Result<()> {
    let session = &ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );
    require!(
        owner == session.player_a || owner == session.player_b,
        BattleError::InvalidCardOwner
    );
    require!(
        effect_type == EFFECT_ATTACK || effect_type == EFFECT_HEAL || effect_type == EFFECT_NONE,
        BattleError::InvalidEffectType
    );

    match effect_type {
        EFFECT_ATTACK | EFFECT_HEAL => {
            require!(
                max_value >= MIN_DAMAGE && max_value <= max_effect_value_for_type(effect_type),
                BattleError::InvalidEffectValue
            );
        }
        EFFECT_NONE => {
            require!(max_value <= MAX_EFFECT_VALUE, BattleError::InvalidEffectValue);
        }
        _ => return err!(BattleError::InvalidEffectType),
    }

    let legacy_damage = if effect_type == EFFECT_ATTACK { max_value } else { 0 };
    let card = &mut ctx.accounts.registered_card;
    initialize_card(
        card,
        ctx.accounts.battle_session.key(),
        card_id,
        owner,
        effect_type,
        max_value,
        legacy_damage,
        ctx.bumps.registered_card,
    );

    emit!(CardRegisteredEvent {
        session: session.key(),
        card: card.key(),
        match_id: session.match_id,
        card_id,
        owner,
        effect_type,
        max_value,
        damage: legacy_damage,
    });

    Ok(())
}

fn initialize_card(
    card: &mut Account<RegisteredCard>,
    session: Pubkey,
    card_id: [u8; 16],
    owner: Pubkey,
    effect_type: u8,
    max_value: u16,
    damage: u16,
    bump: u8,
) {
    card.session = session;
    card.card_id = card_id;
    card.owner = owner;
    card.effect_type = effect_type;
    card.max_value = max_value;
    card.damage = damage;
    card.is_used = false;
    card.bump = bump;
}

#[derive(Accounts)]
#[instruction(card_id: [u8; 16])]
pub struct RegisterCard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
    #[account(
        init, payer = authority,
        space = RegisteredCard::LEN,
        seeds = [CARD_SEED, battle_session.key().as_ref(), card_id.as_ref()],
        bump,
    )]
    pub registered_card: Box<Account<'info, RegisteredCard>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(card_id: [u8; 16])]
pub struct RegisterCardV2<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
    #[account(
        init, payer = authority,
        space = RegisteredCard::LEN,
        seeds = [CARD_SEED, battle_session.key().as_ref(), card_id.as_ref()],
        bump,
    )]
    pub registered_card: Box<Account<'info, RegisteredCard>>,
    pub system_program: Program<'info, System>,
}
