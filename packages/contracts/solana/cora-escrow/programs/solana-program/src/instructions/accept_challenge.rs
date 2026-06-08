use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::error::CoraError;
use crate::events::ChallengeAcceptedEvent;
use crate::state::{MatchState, MatchStatus, OpenChallengeState};

pub fn handler(ctx: Context<AcceptChallenge>, match_id: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        ctx.accounts.creator.key() == ctx.accounts.challenge_state.creator,
        CoraError::UnauthorizedPlayer
    );
    require!(
        now < ctx.accounts.challenge_state.expires_at,
        CoraError::ChallengeExpired
    );
    require!(
        ctx.accounts.challenger.key() != ctx.accounts.challenge_state.creator,
        CoraError::CreatorCannotAccept
    );

    let creator_key = ctx.accounts.challenge_state.creator;
    let token_mint_key = ctx.accounts.challenge_state.token_mint;
    let server_pubkey = ctx.accounts.challenge_state.server_pubkey;
    let wager_amount = ctx.accounts.challenge_state.wager_amount;
    let created_at = ctx.accounts.challenge_state.created_at;
    let challenge_bump = ctx.accounts.challenge_state.bump;
    let decimals = ctx.accounts.token_mint.decimals;
    let challenge_state_info = ctx.accounts.challenge_state.to_account_info();

    let challenge_signer: &[&[&[u8]]] =
        &[&[CHALLENGE_SEED, match_id.as_ref(), &[challenge_bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.challenge_vault.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: challenge_state_info.clone(),
            },
            challenge_signer,
        ),
        wager_amount,
        decimals,
    )?;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.challenger_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.challenger.to_account_info(),
            },
        ),
        wager_amount,
        decimals,
    )?;

    let match_state = &mut ctx.accounts.match_state;
    match_state.version = 1;
    match_state.match_id = match_id;
    match_state.player_a = creator_key;
    match_state.player_b = ctx.accounts.challenger.key();
    match_state.token_mint = token_mint_key;
    match_state.server_pubkey = server_pubkey;
    match_state.wager_amount = wager_amount;
    match_state.status = MatchStatus::Active;
    match_state.bump = ctx.bumps.match_state;
    match_state.created_at = created_at;
    match_state.active_at = now;
    match_state.player_a_deposited = true;
    match_state.player_b_deposited = true;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.challenge_vault.to_account_info(),
            destination: ctx.accounts.creator.to_account_info(),
            authority: challenge_state_info,
        },
        challenge_signer,
    ))?;

    emit!(ChallengeAcceptedEvent {
        match_id,
        creator: creator_key,
        challenger: ctx.accounts.challenger.key(),
        token_mint: token_mint_key,
        wager_amount,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct AcceptChallenge<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    /// CHECK: verified in handler against challenge_state.creator
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, match_id.as_ref()],
        bump = challenge_state.bump,
        close = creator
    )]
    pub challenge_state: Box<Account<'info, OpenChallengeState>>,

    #[account(
        mut,
        seeds = [CHALLENGE_VAULT_SEED, match_id.as_ref()],
        bump = challenge_state.vault_bump,
        token::mint = token_mint,
        token::authority = challenge_state,
    )]
    pub challenge_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = challenge_state.token_mint == token_mint.key() @ CoraError::InvalidTokenMint
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = challenger,
        space = MatchState::LEN,
        seeds = [MATCH_SEED, match_id.as_ref()],
        bump
    )]
    pub match_state: Box<Account<'info, MatchState>>,

    #[account(
        init,
        payer = challenger,
        token::mint = token_mint,
        token::authority = match_state,
        token::token_program = token_program,
        seeds = [VAULT_SEED, match_id.as_ref()],
        bump
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = challenger,
    )]
    pub challenger_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
