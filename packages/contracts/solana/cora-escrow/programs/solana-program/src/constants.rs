
pub const MATCH_SEED: &[u8] = b"match";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const CHALLENGE_VAULT_SEED: &[u8] = b"challenge_vault";
pub const CONFIG_SEED: &[u8] = b"config";

pub const DEPOSIT_TIMEOUT: i64 = 30;      // 15 seconds to deposit
pub const MATCH_TIMEOUT: i64 = 900;       // 15 minutes for active match
pub const CHALLENGE_EXPIRY: i64 = 900;    // 15 minutes for open challenge accept

pub const FEE_BASIS_POINTS: u64 = 250;          // 2.5% fee
pub const BASIS_POINTS_DIVISOR: u64 = 10_000;

pub const MIN_WAGER: u64 = 10_000;
