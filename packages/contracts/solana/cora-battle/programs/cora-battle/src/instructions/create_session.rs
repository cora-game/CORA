use crate::constants::*;
use crate::error::BattleError;
use crate::events::SessionCreatedEvent;
use crate::state::{BattleSession, BattleStatus};
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<CreateSession>,
    match_id: [u8; 32],
    question_hash: [u8; 32],
) -> Result<()> {
    let player_a = ctx.accounts.player_a.key();
    let player_b = ctx.accounts.player_b.key();

    // Prevent self-play exploit
    require!(player_a != player_b, BattleError::SamePlayer);

    let session = &mut ctx.accounts.battle_session;
    session.version = CURRENT_VERSION;
    session.match_id = match_id;
    session.authority = ctx.accounts.authority.key();
    session.player_a = player_a;
    session.player_b = player_b;
    session.health_a = INITIAL_HEALTH;
    session.health_b = INITIAL_HEALTH;
    session.score_a = 0;
    session.score_b = 0;
    session.current_round = 0;
    session.rounds_won_a = 0;
    session.rounds_won_b = 0;
    session.round_started_at = 0;
    session.round_deadline = 0;
    session.player_a_missed_rounds = 0;
    session.player_b_missed_rounds = 0;
    session.total_plays = 0;
    session.status = BattleStatus::WaitingCards;
    session.winner = Pubkey::default();
    session.question_hash = question_hash;
    session.bump = ctx.bumps.battle_session;
    session.created_at = Clock::get()?.unix_timestamp;
    session.finished_at = 0;
    session.end_reason = END_REASON_NONE;
    session.game_score_a = 0;
    session.game_score_b = 0;
    session.round_damage_a = 0;
    session.round_damage_b = 0;
    session.total_slots_a = 0;
    session.total_slots_b = 0;
    session.cards_used_a = 0;
    session.cards_used_b = 0;
    session.manifest_committed_a = false;
    session.manifest_committed_b = false;
    session.card_manifest_a = [0; INLINE_MANIFEST_LEN];
    session.card_manifest_b = [0; INLINE_MANIFEST_LEN];

    emit!(SessionCreatedEvent {
        match_id,
        authority: ctx.accounts.authority.key(),
        player_a,
        player_b,
        question_hash,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Player A wallet address, validated not equal to player B in handler
    pub player_a: UncheckedAccount<'info>,
    /// CHECK: Player B wallet address, validated not equal to player A in handler
    pub player_b: UncheckedAccount<'info>,
    #[account(
        init, payer = authority,
        space = BattleSession::LEN,
        seeds = [BATTLE_SEED, match_id.as_ref()],
        bump,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
    pub system_program: Program<'info, System>,
}
