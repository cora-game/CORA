use anchor_lang::prelude::*;

use crate::constants::INLINE_MANIFEST_LEN;

/// The main battle session account, tracking all on-chain game state.
/// Acts as a backend-authorized battle state mirror. Answer verification and
/// private effect math stay off-chain; ER only records final public effects.
#[account]
pub struct BattleSession {
    /// Schema version for forward-compatible upgrades
    pub version: u8,
    /// Unique match identifier (sha256 of match UUID from backend)
    pub match_id: [u8; 32],
    /// The backend oracle authority that controls this session.
    /// Only this signer can register cards, apply damage, and finalize.
    pub authority: Pubkey,
    /// Player A's wallet address
    pub player_a: Pubkey,
    /// Player B's wallet address
    pub player_b: Pubkey,
    /// Player A's current health points (reset each round)
    pub health_a: u16,
    /// Player B's current health points (reset each round)
    pub health_b: u16,
    /// Canonical rounds won by player A for match winner evaluation.
    pub score_a: u16,
    /// Canonical rounds won by player B for match winner evaluation.
    pub score_b: u16,
    /// Current round number (1-indexed while active, 0 before activation)
    pub current_round: u8,
    /// Legacy duplicate of score_a, kept synchronized for backward compatibility.
    pub rounds_won_a: u8,
    /// Legacy duplicate of score_b, kept synchronized for backward compatibility.
    pub rounds_won_b: u8,
    /// Unix timestamp when the current round started
    pub round_started_at: i64,
    /// Unix timestamp when the current round may be resolved by timeout
    pub round_deadline: i64,
    /// Rounds missed by player A due to timeout
    pub player_a_missed_rounds: u8,
    /// Rounds missed by player B due to timeout
    pub player_b_missed_rounds: u8,
    /// Total resolved card plays applied to ER state (audit trail)
    pub total_plays: u16,
    /// Current battle status (state machine)
    pub status: BattleStatus,
    /// Winner's pubkey (Pubkey::default() until Finished)
    pub winner: Pubkey,
    /// SHA-256 hash of the public question set commitment, not an answer hash.
    pub question_hash: [u8; 32],
    /// PDA bump seed
    pub bump: u8,
    /// Unix timestamp when session was created
    pub created_at: i64,
    /// Unix timestamp when session finished (0 if not finished)
    pub finished_at: i64,
    /// Terminal outcome reason. See END_REASON_* constants.
    pub end_reason: u8,
    /// Cumulative gameplay score for player A, used for final tie-breaks.
    pub game_score_a: u32,
    /// Cumulative gameplay score for player B, used for final tie-breaks.
    pub game_score_b: u32,
    /// Attack damage contributed by player A during the current round.
    pub round_damage_a: u32,
    /// Attack damage contributed by player B during the current round.
    pub round_damage_b: u32,
    /// Total inline manifest slots committed for player A.
    pub total_slots_a: u8,
    /// Total inline manifest slots committed for player B.
    pub total_slots_b: u8,
    /// Replay bitmask for player A card slots.
    pub cards_used_a: u128,
    /// Replay bitmask for player B card slots.
    pub cards_used_b: u128,
    /// Whether player A's manifest has been committed.
    pub manifest_committed_a: bool,
    /// Whether player B's manifest has been committed.
    pub manifest_committed_b: bool,
    /// Packed inline manifest for player A.
    pub card_manifest_a: [u8; INLINE_MANIFEST_LEN],
    /// Packed inline manifest for player B.
    pub card_manifest_b: [u8; INLINE_MANIFEST_LEN],
}

impl BattleSession {
    // 8 (disc) + 1 (ver) + 32 (match_id) + 32 (authority) + 32 (player_a)
    // + 32 (player_b) + 2 (hp_a) + 2 (hp_b) + 2 (score_a) + 2 (score_b)
    // + 1 (round) + 1 (won_a) + 1 (won_b) + 8 (round_started)
    // + 8 (round_deadline) + 1 (missed_a) + 1 (missed_b) + 2 (plays)
    // + 1 (status) + 32 (winner) + 32 (q_hash) + 1 (bump)
    // + 8 (created) + 8 (finished) + 1 (end_reason)
    // + 4 (game_score_a) + 4 (game_score_b)
    // + 4 (round_damage_a) + 4 (round_damage_b)
    // + 1 (total_slots_a) + 1 (total_slots_b)
    // + 16 (cards_used_a) + 16 (cards_used_b)
    // + 1 (manifest_committed_a) + 1 (manifest_committed_b)
    // + 384 (card_manifest_a) + 384 (card_manifest_b)
    pub const LEN: usize = 8
        + 1
        + 32
        + 32
        + 32
        + 32
        + 2
        + 2
        + 2
        + 2
        + 1
        + 1
        + 1
        + 8
        + 8
        + 1
        + 1
        + 2
        + 1
        + 32
        + 32
        + 1
        + 8
        + 8
        + 1
        + 4
        + 4
        + 4
        + 4
        + 1
        + 1
        + 16
        + 16
        + 1
        + 1
        + INLINE_MANIFEST_LEN
        + INLINE_MANIFEST_LEN; // = 1071

    /// Determine the match winner using the GameEngine's public final ordering:
    /// rounds won, then gameplay score, then remaining health, else draw.
    pub fn determine_winner_by_match_rules(&self) -> Option<Pubkey> {
        if self.score_a != self.score_b {
            return Some(if self.score_a > self.score_b {
                self.player_a
            } else {
                self.player_b
            });
        }

        if self.game_score_a != self.game_score_b {
            return Some(if self.game_score_a > self.game_score_b {
                self.player_a
            } else {
                self.player_b
            });
        }

        if self.health_a != self.health_b {
            return Some(if self.health_a > self.health_b {
                self.player_a
            } else {
                self.player_b
            });
        }

        None
    }
}

/// State machine for battle lifecycle.
/// Transitions: WaitingCards → Active → Finished
///                                    → Cancelled (via force_end)
///              WaitingCards → Cancelled (via force_end)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum BattleStatus {
    /// Session created, waiting for card registration
    WaitingCards,
    /// Cards registered, game in progress
    Active,
    /// Game ended with a winner
    Finished,
    /// Session was cancelled or timed out
    Cancelled,
}

/// A registered card representing one question's public ER effect envelope.
/// The card_id uses dummy ephemeral IDs to prevent correlation with
/// real question IDs in the database (privacy via Ephemeral Mapping).
#[account]
pub struct RegisteredCard {
    /// Reference to parent BattleSession PDA
    pub session: Pubkey,
    /// Dummy card identifier for ephemeral mapping
    pub card_id: [u8; 16],
    /// Player who is allowed to resolve this card in ER.
    pub owner: Pubkey,
    /// Public effect kind used for auditable ER state changes.
    pub effect_type: u8,
    /// Maximum final effect value the backend may authorize for this card.
    pub max_value: u16,
    /// Legacy damage-only attack value used by apply_damage compatibility flow.
    pub damage: u16,
    /// Replay protection — card can only be used once
    pub is_used: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl RegisteredCard {
    // 8 (disc) + 32 (session) + 16 (card_id) + 32 (owner) + 1 (effect_type)
    // + 2 (max_value) + 2 (damage) + 1 (is_used) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 16 + 32 + 1 + 2 + 2 + 1 + 1; // = 95
}
