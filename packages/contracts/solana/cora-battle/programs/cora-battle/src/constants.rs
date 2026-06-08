/// PDA seed for BattleSession accounts
pub const BATTLE_SEED: &[u8] = b"battle";

/// PDA seed for RegisteredCard accounts
pub const CARD_SEED: &[u8] = b"card";

/// Starting HP for each player at the beginning of a round
pub const INITIAL_HEALTH: u16 = 100;

/// Best-of-N rounds format
pub const MAX_ROUNDS: u8 = 3;

/// Rounds needed to win the match
pub const ROUNDS_TO_WIN: u8 = 2;

/// Duration of one active round before timeout resolution is allowed
pub const ROUND_DURATION_SECONDS: i64 = 180;

/// Maximum damage a single card can deal (prevents one-shot exploits)
pub const MAX_DAMAGE: u16 = 100;

/// Gameplay base attack damage before phase/specialty multipliers.
pub const BASE_DAMAGE: u16 = 16;

/// Gameplay base healing before phase/specialty multipliers.
pub const BASE_HEAL: u16 = 8;

/// Public effect type for a backend-authorized attack card.
pub const EFFECT_ATTACK: u8 = 1;
/// Public effect type for a backend-authorized heal card.
pub const EFFECT_HEAL: u8 = 2;
/// Public effect type for a consume-only card with no HP mutation.
pub const EFFECT_NONE: u8 = 3;

/// Maximum gameplay multiplier expressed as 2x extra-point * 1.5x specialty.
pub const MAX_EFFECT_MULTIPLIER: u16 = 3;

/// Maximum final attack value the backend may authorize.
pub const MAX_ATTACK_EFFECT_VALUE: u16 = BASE_DAMAGE * MAX_EFFECT_MULTIPLIER;

/// Maximum final heal value the backend may authorize.
pub const MAX_HEAL_EFFECT_VALUE: u16 = BASE_HEAL * MAX_EFFECT_MULTIPLIER;

/// Maximum final effect value the backend may authorize for ATTACK/HEAL cards.
pub const MAX_EFFECT_VALUE: u16 = MAX_ATTACK_EFFECT_VALUE;

pub const fn max_effect_value_for_type(effect_type: u8) -> u16 {
    match effect_type {
        EFFECT_ATTACK => MAX_ATTACK_EFFECT_VALUE,
        EFFECT_HEAL => MAX_HEAL_EFFECT_VALUE,
        EFFECT_NONE => 0,
        _ => 0,
    }
}

/// Maximum gameplay-score delta the backend may apply from one card resolution.
pub const MAX_SCORE_DELTA: u32 = 10_000;

/// Maximum number of committed card slots per player in the inline manifest.
pub const MAX_CARD_SLOTS: u8 = 128;

/// Packed bytes per inline manifest slot: effect_type (1) + max_value (2).
pub const MANIFEST_ENTRY_SIZE: usize = 3;

/// Total inline manifest bytes per player.
pub const INLINE_MANIFEST_LEN: usize = MAX_CARD_SLOTS as usize * MANIFEST_ENTRY_SIZE;

/// Score delta ceiling relative to final_value for inline manifest effects.
pub const MAX_SCORE_MULTIPLIER: u32 = 100;

/// Minimum damage a single card can deal (prevents zero-damage griefing)
pub const MIN_DAMAGE: u16 = 1;

/// Session expires after 15 minutes (prevents stale sessions)
pub const SESSION_TIMEOUT: i64 = 900;

/// Current state schema version for forward-compatible upgrades
pub const CURRENT_VERSION: u8 = 5;

pub const END_REASON_NONE: u8 = 0;
pub const END_REASON_NORMAL_WIN: u8 = 1;
pub const END_REASON_SINGLE_PLAYER_TIMEOUT: u8 = 2;
pub const END_REASON_BOTH_PLAYERS_TIMEOUT: u8 = 3;
pub const END_REASON_SERVER_CANCELLED: u8 = 4;
pub const END_REASON_CHEATER_FLAGGED: u8 = 5;
pub const END_REASON_FORCE_ENDED: u8 = 6;
pub const END_REASON_DRAW_NO_CONTEST: u8 = 7;
pub const END_REASON_SURRENDER: u8 = 8;
