use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BattleError;
use crate::events::ManifestCommittedEvent;
use crate::state::{BattleSession, BattleStatus};

pub fn handler(
    ctx: Context<SetCardManifest>,
    is_player_a: bool,
    total_slots: u8,
    manifest: Vec<u8>,
) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );
    require!(
        total_slots >= 1 && total_slots <= MAX_CARD_SLOTS,
        BattleError::InvalidManifest
    );

    let expected_len = usize::from(total_slots) * MANIFEST_ENTRY_SIZE;
    require!(manifest.len() == expected_len, BattleError::InvalidManifest);

    for slot_bytes in manifest.chunks_exact(MANIFEST_ENTRY_SIZE) {
        let effect_type = slot_bytes[0];
        let max_value = u16::from_le_bytes([slot_bytes[1], slot_bytes[2]]);

        require!(
            effect_type == EFFECT_ATTACK
                || effect_type == EFFECT_HEAL
                || effect_type == EFFECT_NONE,
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
                require!(max_value == 0, BattleError::InvalidManifest);
            }
            _ => return err!(BattleError::InvalidEffectType),
        }
    }

    let target_manifest = if is_player_a {
        require!(
            !session.manifest_committed_a,
            BattleError::InvalidManifest
        );
        session.total_slots_a = total_slots;
        session.manifest_committed_a = true;
        &mut session.card_manifest_a
    } else {
        require!(
            !session.manifest_committed_b,
            BattleError::InvalidManifest
        );
        session.total_slots_b = total_slots;
        session.manifest_committed_b = true;
        &mut session.card_manifest_b
    };

    target_manifest.fill(0);
    target_manifest[..manifest.len()].copy_from_slice(&manifest);

    emit!(ManifestCommittedEvent {
        session: session.key(),
        match_id: session.match_id,
        is_player_a,
        total_slots,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetCardManifest<'info> {
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
