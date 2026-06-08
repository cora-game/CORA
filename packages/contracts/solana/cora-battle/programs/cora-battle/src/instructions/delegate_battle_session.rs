use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::BattleError;
use crate::state::BattleSession;

pub fn handler(ctx: Context<DelegateBattleSession>) -> Result<()> {
    let (authority, match_id) = {
        let data = ctx.accounts.battle_session.try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        let session = BattleSession::try_deserialize(&mut data_slice)?;
        (session.authority, session.match_id)
    };

    require_keys_eq!(
        authority,
        ctx.accounts.payer.key(),
        BattleError::UnauthorizedAuthority
    );

    ctx.accounts.delegate_battle_session(
        &ctx.accounts.payer,
        &[BATTLE_SEED, match_id.as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;

    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateBattleSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The MagicBlock delegation program validates the PDA and rewrites ownership.
    #[account(mut, del)]
    pub battle_session: AccountInfo<'info>,
}
