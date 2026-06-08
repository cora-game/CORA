use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::error::BattleError;
use crate::state::{BattleSession, RegisteredCard};

pub fn commit_handler(ctx: Context<CommitRegisteredCard>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.registered_card.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}

pub fn undelegate_handler(ctx: Context<CommitRegisteredCard>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.registered_card.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct CommitRegisteredCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        constraint = battle_session.authority == payer.key()
            @ BattleError::UnauthorizedAuthority,
    )]
    pub battle_session: Box<Account<'info, BattleSession>>,
    #[account(
        mut,
        constraint = registered_card.session == battle_session.key()
            @ BattleError::UnregisteredCard,
    )]
    pub registered_card: Box<Account<'info, RegisteredCard>>,
}
