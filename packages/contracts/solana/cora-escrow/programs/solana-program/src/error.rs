use anchor_lang::prelude::*;

#[error_code]
pub enum CoraError {
    #[msg("Wager amount must be greater than min_wager")]
    InvalidWagerAmount,

    #[msg("Player A and Player B cannot be the same")]
    SamePlayer,

    #[msg("Player is not a participant in this match")]
    UnauthorizedPlayer,

    #[msg("Player has already deposited")]
    AlreadyDeposited,

    #[msg("Match is not in active status")]
    NotActive,

    #[msg("Match is already settled or refunded")]
    AlreadyFinalized,

    #[msg("Match is not waiting for deposits")]
    NotWaitingDeposit,

    #[msg("Invalid action parameter")]
    InvalidAction,

    #[msg("Invalid settlement signature")]
    InvalidSignature,

    #[msg("Winner must be a match participant")]
    InvalidWinner,

    #[msg("Timeout has not been reached yet")]
    TimeoutNotReached,

    #[msg("Token mint does not match match state")]
    InvalidTokenMint,

    #[msg("Match state is inconsistent for refund")]
    InvalidRefundState,

    #[msg("Only the admin can perform this action")]
    UnauthorizedAdmin,

    #[msg("Treasury account does not belong to the configured authority")]
    InvalidTreasury,

    #[msg("Open challenge has expired")]
    ChallengeExpired,

    #[msg("Open challenge has not expired yet")]
    ChallengeNotExpired,

    #[msg("Creator cannot accept their own challenge")]
    CreatorCannotAccept,
}
