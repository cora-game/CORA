use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::CoraError;
use crate::events::ConfigUpdatedEvent;
use crate::state::ProgramConfig;

pub fn handler(ctx: Context<UpdateConfig>, new_treasury_authority: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.treasury_authority = new_treasury_authority;

    emit!(ConfigUpdatedEvent {
        admin: ctx.accounts.admin.key(),
        new_treasury_authority,
    });

    msg!("CORA: Treasury authority updated to {}", new_treasury_authority);

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = admin.key() == config.admin @ CoraError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, ProgramConfig>,
}
