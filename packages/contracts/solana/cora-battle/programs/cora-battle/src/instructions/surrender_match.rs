use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::MatchSurrenderedEvent;
use crate::instructions::match_updates::finalize_with_winner;
use crate::state::{BattleSession, BattleStatus};

pub fn handler(ctx: Context<SurrenderMatch>, surrendering_player: Pubkey) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    let session_key = session.key();

    require!(
        session.status == BattleStatus::Active,
        BattleError::InvalidStatus
    );

    let winner = if surrendering_player == session.player_a {
        session.player_b
    } else if surrendering_player == session.player_b {
        session.player_a
    } else {
        return err!(BattleError::InvalidSurrenderPlayer);
    };

    let now = Clock::get()?.unix_timestamp;
    finalize_with_winner(session, session_key, winner, END_REASON_SURRENDER, now);

    emit!(MatchSurrenderedEvent {
        session: session_key,
        surrendering_player,
        winner,
        current_round: session.current_round,
        score_a: session.score_a,
        score_b: session.score_b,
        game_score_a: session.game_score_a,
        game_score_b: session.game_score_b,
        finished_at: session.finished_at,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SurrenderMatch<'info> {
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
