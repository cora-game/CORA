use crate::constants::*;
use crate::error::BattleError;
use crate::events::BattleFinalizedEvent;
use crate::state::{BattleSession, BattleStatus};
use anchor_lang::prelude::*;

/// Called by the authority after the ER commits to mainchain.
/// Emits the BattleFinalizedEvent for the settlement oracle.
/// This is an idempotent read-and-emit — safe to retry on tx failure.
pub fn handler(ctx: Context<FinalizeMatch>) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::Finished,
        BattleError::InvalidStatus
    );

    if session.end_reason == END_REASON_NONE {
        session.end_reason = END_REASON_NORMAL_WIN;
    }

    msg!("Battle finalized. Winner: {}", session.winner);

    emit!(BattleFinalizedEvent {
        session: session.key(),
        match_id: session.match_id,
        winner: session.winner,
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

    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeMatch<'info> {
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
