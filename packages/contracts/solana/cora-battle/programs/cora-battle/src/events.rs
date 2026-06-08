use anchor_lang::prelude::*;

#[event]
pub struct SessionCreatedEvent {
    pub match_id: [u8; 32],
    pub authority: Pubkey,
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub question_hash: [u8; 32],
}

#[event]
pub struct CardRegisteredEvent {
    pub session: Pubkey,
    pub card: Pubkey,
    pub match_id: [u8; 32],
    pub card_id: [u8; 16],
    pub owner: Pubkey,
    pub effect_type: u8,
    pub max_value: u16,
    pub damage: u16,
}

#[event]
pub struct SessionActivatedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub current_round: u8,
    pub round_deadline: i64,
}

#[event]
pub struct DamageAppliedEvent {
    pub match_id: [u8; 32],
    pub attacker: Pubkey,
    pub damage: u16,
    pub health_a: u16,
    pub health_b: u16,
    pub round: u8,
}

#[event]
pub struct CardEffectAppliedEvent {
    pub session: Pubkey,
    pub card: Pubkey,
    pub actor: Pubkey,
    pub effect_type: u8,
    pub final_value: u16,
    pub score_delta: u32,
    pub health_a: u16,
    pub health_b: u16,
    pub score_a: u16,
    pub score_b: u16,
    pub game_score_a: u32,
    pub game_score_b: u32,
    pub current_round: u8,
}

#[event]
pub struct ManifestCommittedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub is_player_a: bool,
    pub total_slots: u8,
}

#[event]
pub struct EffectAppliedEvent {
    pub session: Pubkey,
    pub actor: Pubkey,
    pub actor_is_a: bool,
    pub slot: u8,
    pub effect_type: u8,
    pub max_value: u16,
    pub final_value: u16,
    pub score_delta: u32,
    pub health_a: u16,
    pub health_b: u16,
    pub score_a: u16,
    pub score_b: u16,
    pub game_score_a: u32,
    pub game_score_b: u32,
    pub current_round: u8,
}

#[event]
pub struct RoundEndedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub round: u8,
    pub round_winner: Pubkey,
    pub rounds_won_a: u8,
    pub rounds_won_b: u8,
}

#[event]
pub struct RoundTimedOutEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub timed_out_player: Pubkey,
    pub round_winner: Pubkey,
    pub current_round: u8,
    /// Canonical round wins for player A.
    pub score_a: u16,
    /// Canonical round wins for player B.
    pub score_b: u16,
}

#[event]
pub struct RoundAdvancedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub current_round: u8,
    pub round_deadline: i64,
}

#[event]
pub struct RoundResolvedByStateEvent {
    pub session: Pubkey,
    pub round: u8,
    pub resolver: Pubkey,
    pub health_a: u16,
    pub health_b: u16,
    pub round_damage_a: u32,
    pub round_damage_b: u32,
    pub round_winner: Pubkey,
    pub score_a: u16,
    pub score_b: u16,
    pub game_score_a: u32,
    pub game_score_b: u32,
    pub next_round: u8,
    pub deadline: i64,
    pub was_draw: bool,
}

#[event]
pub struct BattleFinalizedEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub winner: Pubkey,
    pub end_reason: u8,
    /// Canonical round wins for player A.
    pub score_a: u16,
    /// Canonical round wins for player B.
    pub score_b: u16,
    /// Legacy duplicate of score_a, kept for compatibility.
    pub rounds_won_a: u8,
    /// Legacy duplicate of score_b, kept for compatibility.
    pub rounds_won_b: u8,
    pub health_a: u16,
    pub health_b: u16,
    pub game_score_a: u32,
    pub game_score_b: u32,
}

#[event]
pub struct SessionCancelledEvent {
    pub session: Pubkey,
    pub match_id: [u8; 32],
    pub reason: u8,
    pub finished_at: i64,
}

#[event]
pub struct MatchSurrenderedEvent {
    pub session: Pubkey,
    pub surrendering_player: Pubkey,
    pub winner: Pubkey,
    pub current_round: u8,
    pub score_a: u16,
    pub score_b: u16,
    pub game_score_a: u32,
    pub game_score_b: u32,
    pub finished_at: i64,
}
