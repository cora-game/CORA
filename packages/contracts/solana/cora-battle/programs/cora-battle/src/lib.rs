use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic");

#[ephemeral]
#[program]
pub mod cora_battle {
    use super::*;

    /// Create a new battle session for two players.
    /// The signer becomes the session authority (backend oracle).
    pub fn create_session(
        ctx: Context<CreateSession>,
        match_id: [u8; 32],
        question_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_session::handler(ctx, match_id, question_hash)
    }

    /// Register a card (question mapping) for a battle session.
    /// Legacy damage-only path. New effect-aware flows should use register_card_v2.
    pub fn register_card(ctx: Context<RegisterCard>, card_id: [u8; 16], damage: u16) -> Result<()> {
        instructions::register_card::handler(ctx, card_id, damage)
    }

    /// Register an effect-aware card for ER resolution.
    /// Authority-only. Only allowed in WaitingCards status.
    pub fn register_card_v2(
        ctx: Context<RegisterCardV2>,
        card_id: [u8; 16],
        owner: Pubkey,
        effect_type: u8,
        max_value: u16,
    ) -> Result<()> {
        instructions::register_card::handler_v2(ctx, card_id, owner, effect_type, max_value)
    }

    /// Activate the session after card registration is complete.
    /// Transitions WaitingCards → Active. Authority-only.
    pub fn activate_session(ctx: Context<ActivateSession>) -> Result<()> {
        instructions::activate_session::handler(ctx)
    }

    /// Commit the immutable inline manifest for one player before activation.
    pub fn set_card_manifest(
        ctx: Context<SetCardManifest>,
        is_player_a: bool,
        total_slots: u8,
        manifest: Vec<u8>,
    ) -> Result<()> {
        instructions::set_card_manifest::handler(ctx, is_player_a, total_slots, manifest)
    }

    /// Apply damage to the opponent of the attacker.
    /// Authority-only. Backend verifies the answer off-chain,
    /// then calls this to record damage on-chain.
    pub fn apply_damage(ctx: Context<ApplyDamage>, attacker: Pubkey) -> Result<()> {
        instructions::apply_damage::handler(ctx, attacker)
    }

    /// Apply a backend-authorized final card effect to ER battle state.
    /// The backend remains the source of truth for answer validation and
    /// private multiplier computation; ER only stores the final public effect.
    pub fn apply_card_effect(
        ctx: Context<ApplyCardEffect>,
        final_value: u16,
        score_delta: u32,
    ) -> Result<()> {
        instructions::apply_card_effect::handler(ctx, final_value, score_delta)
    }

    /// Apply a committed inline manifest slot to ER battle state.
    pub fn apply_effect(
        ctx: Context<ApplyEffect>,
        slot: u8,
        actor_is_a: bool,
        final_value: u16,
        score_delta: u32,
    ) -> Result<()> {
        instructions::apply_effect::handler(ctx, slot, actor_is_a, final_value, score_delta)
    }

    /// Resolve a timer-expired round from current ER state.
    /// Uses only public state: health, round damage, and existing match totals.
    pub fn resolve_round_by_state(ctx: Context<ResolveRoundByState>) -> Result<()> {
        instructions::resolve_round_by_state::handler(ctx)
    }

    /// Resolve a single-player round timeout after the round deadline.
    /// Reconnects before this deadline are handled off-chain by the backend.
    pub fn timeout_player_for_round(
        ctx: Context<TimeoutPlayerForRound>,
        timed_out_player: Pubkey,
    ) -> Result<()> {
        instructions::timeout_player_for_round::handler(ctx, timed_out_player)
    }

    /// Cancel an unresolved session with an explicit ER outcome reason.
    pub fn cancel_session(ctx: Context<CancelSession>, reason: u8) -> Result<()> {
        instructions::cancel_session::handler(ctx, reason)
    }

    /// Finish the match immediately when one player surrenders.
    pub fn surrender_match(
        ctx: Context<SurrenderMatch>,
        surrendering_player: Pubkey,
    ) -> Result<()> {
        instructions::surrender_match::handler(ctx, surrendering_player)
    }

    /// Emit the BattleFinalized event for the settlement oracle.
    /// Authority-only. Session must be in Finished status.
    pub fn finalize_match(ctx: Context<FinalizeMatch>) -> Result<()> {
        instructions::finalize_match::handler(ctx)
    }

    /// Force-end a timed-out session. Authority-only.
    /// Only callable after SESSION_TIMEOUT has elapsed.
    pub fn force_end(ctx: Context<ForceEnd>) -> Result<()> {
        instructions::force_end::handler(ctx)
    }

    /// Close a terminal session account and reclaim rent SOL.
    /// Authority-only. Only Finished or Cancelled sessions.
    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::close_session::handler(ctx)
    }

    /// Delegate the BattleSession PDA from the Solana base layer to MagicBlock ER.
    pub fn delegate_battle_session(ctx: Context<DelegateBattleSession>) -> Result<()> {
        instructions::delegate_battle_session::handler(ctx)
    }

    /// Delegate one RegisteredCard PDA so replay state can be mutated in ER.
    pub fn delegate_registered_card(
        ctx: Context<DelegateRegisteredCard>,
        card_id: [u8; 16],
    ) -> Result<()> {
        instructions::delegate_registered_card::handler(ctx, card_id)
    }

    /// Schedule a BattleSession state commit from ER back to Solana.
    pub fn commit_battle_session(ctx: Context<CommitBattleSession>) -> Result<()> {
        instructions::commit_battle_session::commit_handler(ctx)
    }

    /// Commit and undelegate the BattleSession PDA when the battle has ended.
    pub fn undelegate_battle_session(ctx: Context<CommitBattleSession>) -> Result<()> {
        instructions::commit_battle_session::undelegate_handler(ctx)
    }

    /// Schedule a RegisteredCard state commit from ER back to Solana.
    pub fn commit_registered_card(ctx: Context<CommitRegisteredCard>) -> Result<()> {
        instructions::commit_registered_card::commit_handler(ctx)
    }

    /// Commit and undelegate a RegisteredCard PDA when the battle has ended.
    pub fn undelegate_registered_card(ctx: Context<CommitRegisteredCard>) -> Result<()> {
        instructions::commit_registered_card::undelegate_handler(ctx)
    }
}
