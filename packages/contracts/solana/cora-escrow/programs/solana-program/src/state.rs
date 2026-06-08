use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub version: u8,
    pub admin: Pubkey,
    pub treasury_authority: Pubkey,
    pub bump: u8,
}

impl ProgramConfig {
    // 8 (discriminator) + 1 (version) + 32 (admin) + 32 (treasury_authority) + 1 (bump) = 74
    pub const LEN: usize = 8 + 1 + 32 + 32 + 1;
}

#[account]
pub struct MatchState {
    pub version: u8,
    pub match_id: [u8; 32],
    pub player_a: Pubkey,
    pub player_b: Pubkey,
    pub token_mint: Pubkey,
    pub server_pubkey: Pubkey,
    pub wager_amount: u64,
    pub status: MatchStatus,
    pub bump: u8,
    pub created_at: i64,
    pub active_at: i64,
    pub player_a_deposited: bool,
    pub player_b_deposited: bool,
}

impl MatchState {
    // 8 (discriminator) + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 1 = 197
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 1;
}

#[account]
pub struct OpenChallengeState {
    pub version: u8,
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub server_pubkey: Pubkey,
    pub wager_amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl OpenChallengeState {
    // 8 + 1 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1 = 163
    pub const LEN: usize = 8 + 1 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchStatus {
    WaitingDeposit,
    Active,
    Settled,
    Refunded,
}
