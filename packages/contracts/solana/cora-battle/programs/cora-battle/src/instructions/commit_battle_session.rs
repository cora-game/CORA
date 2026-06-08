use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::constants::*;
use crate::error::BattleError;
use crate::state::BattleSession;

pub fn commit_handler(ctx: Context<CommitBattleSession>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.battle_session.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}

pub fn undelegate_handler(ctx: Context<CommitBattleSession>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.battle_session.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct CommitBattleSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == payer.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
}
