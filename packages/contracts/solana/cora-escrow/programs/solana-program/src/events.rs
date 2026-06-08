use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitializedEvent {
    pub admin: Pubkey,
    pub treasury_authority: Pubkey,
}

#[event]
pub struct ConfigUpdatedEvent {
    pub admin: Pubkey,
    pub new_treasury_authority: Pubkey,
}

#[event]
pub struct MatchInitializedEvent {
    pub match_id: [u8; 32],
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub token_mint: Pubkey,
    pub wager_amount: u64,
}

#[event]
pub struct WagerDepositedEvent {
    pub match_id: [u8; 32],
    pub depositor: Pubkey,
    pub amount: u64,
    pub match_active: bool,
}

#[event]
pub struct MatchSettledEvent {
    pub match_id: [u8; 32],
    pub action: u8,
    pub target: Pubkey,
}

#[event]
pub struct MatchRefundedEvent {
    pub match_id: [u8; 32],
}

#[event]
pub struct OpenChallengeCreatedEvent {
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub wager_amount: u64,
    pub expires_at: i64,
}

#[event]
pub struct ChallengeAcceptedEvent {
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub token_mint: Pubkey,
    pub wager_amount: u64,
}

#[event]
pub struct ChallengeReclaimedEvent {
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub refunded_amount: u64,
}
