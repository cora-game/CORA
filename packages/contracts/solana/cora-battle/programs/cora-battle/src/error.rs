use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Session is not in the expected status")]
    InvalidStatus,

    #[msg("Player is not a participant in this session")]
    UnauthorizedPlayer,

    #[msg("Card does not belong to this session")]
    UnregisteredCard,

    #[msg("Only the session authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Session has already finished")]
    AlreadyFinished,

    #[msg("Player A and Player B cannot be the same address")]
    SamePlayer,

    #[msg("Card has already been used in this session")]
    CardAlreadyUsed,

    #[msg("Damage value is out of allowed range")]
    InvalidDamage,

    #[msg("Effect type is not valid for this card")]
    InvalidEffectType,

    #[msg("Effect value is not valid for this card")]
    InvalidEffectValue,

    #[msg("Gameplay score delta is out of allowed range")]
    InvalidScoreDelta,

    #[msg("Registered card owner is not valid for this session")]
    InvalidCardOwner,

    #[msg("Current round state is not valid for this instruction")]
    InvalidRoundState,

    #[msg("Target must be a participant in this session")]
    InvalidTarget,

    #[msg("Session timeout has not been reached yet")]
    TimeoutNotReached,

    #[msg("Round deadline has passed for applying card effects")]
    RoundDeadlinePassed,

    #[msg("End reason is not valid for this instruction")]
    InvalidEndReason,

    #[msg("Session has expired due to timeout")]
    SessionExpired,

    #[msg("Arithmetic overflow in game state calculation")]
    ArithmeticOverflow,

    #[msg("Card manifest has not been committed yet")]
    ManifestNotCommitted,

    #[msg("Card manifest data is invalid")]
    InvalidManifest,

    #[msg("Card slot index is out of bounds")]
    SlotOutOfBounds,

    #[msg("Score delta exceeds multiplier-based maximum")]
    ScoreDeltaExceedsMultiplier,

    #[msg("Surrendering player is invalid")]
    InvalidSurrenderPlayer,
}
