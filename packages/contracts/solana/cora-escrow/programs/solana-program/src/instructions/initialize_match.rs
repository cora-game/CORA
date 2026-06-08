use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::constants::*;
use crate::error::CoraError;
use crate::events::MatchInitializedEvent;
use crate::state::{MatchState, MatchStatus};

pub fn handler(
    ctx: Context<InitializeMatch>,
    match_id: [u8; 32],
    wager_amount: u64,
    server_pubkey: Pubkey,  
) -> Result<()> {
    require!(wager_amount >= MIN_WAGER, CoraError::InvalidWagerAmount);

    require!(
        ctx.accounts.player_a.key() != ctx.accounts.player_b.key(),
        CoraError::SamePlayer
    );

    let match_state = &mut ctx.accounts.match_state;
    let clock = Clock::get()?;

    match_state.version            = 1;
    match_state.match_id           = match_id;
    match_state.player_a           = ctx.accounts.player_a.key();
    match_state.player_b           = ctx.accounts.player_b.key();
    match_state.token_mint         = ctx.accounts.token_mint.key();
    match_state.server_pubkey      = server_pubkey;
    match_state.wager_amount       = wager_amount;
    match_state.status             = MatchStatus::WaitingDeposit;
    match_state.bump               = ctx.bumps.match_state;
    match_state.created_at         = clock.unix_timestamp;
    match_state.active_at          = 0;
    match_state.player_a_deposited = false;
    match_state.player_b_deposited = false;

    emit!(MatchInitializedEvent {
        match_id,
        player_a: match_state.player_a,
        player_b: match_state.player_b,
        token_mint: match_state.token_mint,
        wager_amount,
    });

    msg!("CORA: Match initialized");
    msg!("Player A: {}", match_state.player_a);
    msg!("Player B: {}", match_state.player_b);
    msg!("Wager: {}", wager_amount);

    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct InitializeMatch<'info> {
    #[account(mut)]
    pub player_a: Signer<'info>,

    /// CHECK: player_b pubkey is only stored here for later validation during the deposit phase. No data is read or written.
    pub player_b: UncheckedAccount<'info>,
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = player_a,
        space = MatchState::LEN,
        seeds = [MATCH_SEED, match_id.as_ref()],
        bump
    )]
    pub match_state: Account<'info, MatchState>,

    #[account(
        init,
        payer = player_a,
        token::mint = token_mint,
        token::authority = match_state,
        token::token_program = token_program,
        seeds = [VAULT_SEED, match_id.as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
