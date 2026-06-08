use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus};
use crate::constants::*;
use crate::error::BattleError;

/// Close the BattleSession account and reclaim rent SOL.
/// Only callable on terminal states (Finished or Cancelled).
/// The rent goes back to the authority who paid for creation.
pub fn handler(_ctx: Context<CloseSession>) -> Result<()> {
    // Account closing is handled by the Anchor `close` constraint.
    // No additional logic needed — this instruction exists solely
    // to gate the close behind proper authorization checks.
    Ok(())
}

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = authority,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        constraint = battle_session.status == BattleStatus::Finished
            || battle_session.status == BattleStatus::Cancelled
            @ BattleError::InvalidStatus,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
}
