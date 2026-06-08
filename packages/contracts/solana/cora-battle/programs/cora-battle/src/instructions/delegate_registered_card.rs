use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::BattleError;
use crate::state::BattleSession;

pub fn handler(ctx: Context<DelegateRegisteredCard>, card_id: [u8; 16]) -> Result<()> {
    let authority = {
        let data = ctx.accounts.battle_session.try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        let session = BattleSession::try_deserialize(&mut data_slice)?;
        session.authority
    };

    require_keys_eq!(
        authority,
        ctx.accounts.payer.key(),
        BattleError::UnauthorizedAuthority
    );

    ctx.accounts.delegate_registered_card(
        &ctx.accounts.payer,
        &[CARD_SEED, ctx.accounts.battle_session.key().as_ref(), card_id.as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;

    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateRegisteredCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This may already be owned by the delegation program after session delegation.
    #[account(mut)]
    pub battle_session: AccountInfo<'info>,
    /// CHECK: The MagicBlock delegation program validates the PDA and rewrites ownership.
    #[account(mut, del)]
    pub registered_card: AccountInfo<'info>,
}
