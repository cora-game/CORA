use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};
use crate::constants::*;
use crate::error::CoraError;
use crate::events::MatchSettledEvent;
use crate::state::{MatchState, MatchStatus, ProgramConfig};
use solana_instructions_sysvar::{
    load_current_index_checked, load_instruction_at_checked, ID as INSTRUCTIONS_SYSVAR_ID,
};
use solana_sdk_ids::ed25519_program;

pub fn handler(
    ctx: Context<SettleMatch>,
    action: u8,
    target: Pubkey,
    signature: [u8; 64],
) -> Result<()> {
    let player_a = ctx.accounts.match_state.player_a;
    let player_b = ctx.accounts.match_state.player_b;
    let server_pubkey = ctx.accounts.match_state.server_pubkey;
    let wager_amount = ctx.accounts.match_state.wager_amount;
    let match_id = ctx.accounts.match_state.match_id;
    let bump = ctx.accounts.match_state.bump;
    let token_decimals = ctx.accounts.token_mint.decimals;

    require!(
        ctx.accounts.match_state.status == MatchStatus::Active,
        CoraError::NotActive
    );

    require!(
        action == 0 || action == 1,
        CoraError::InvalidAction
    );

    require!(
        target == player_a || target == player_b,
        CoraError::InvalidWinner
    );

    let mut message = [0u8; 65];
    message[0] = action;
    message[1..33].copy_from_slice(&match_id);
    message[33..65].copy_from_slice(&target.to_bytes());

    verify_ed25519(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &server_pubkey.to_bytes(),
        &message,
        &signature,
    )?;

    let seeds: &[&[&[u8]]] = &[&[MATCH_SEED, match_id.as_ref(), &[bump]]];
    let match_state_info = ctx.accounts.match_state.to_account_info();

    if action == 0 {
        // action 0: Win (target is winner)
        let total = wager_amount
            .checked_mul(2)
            .ok_or(CoraError::InvalidWagerAmount)?;

        let fee = total
            .checked_mul(FEE_BASIS_POINTS)
            .ok_or(CoraError::InvalidWagerAmount)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(CoraError::InvalidWagerAmount)?;

        let winner_amount = total
            .checked_sub(fee)
            .ok_or(CoraError::InvalidWagerAmount)?;

        let winner_token_account = if target == player_a {
            ctx.accounts.player_a_token_account.to_account_info()
        } else {
            ctx.accounts.player_b_token_account.to_account_info()
        };

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        winner_token_account,
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            winner_amount,
            token_decimals,
        )?;

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        ctx.accounts.treasury.to_account_info(),
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            fee,
            token_decimals,
        )?;

        msg!("Match settled! Winner: {}", target);
    } else {
        // action 1: Penalty (target is cheater)
        // Cheater forfeits wager to Treasury
        // Honest player gets their 100% wager back
        let honest_token_account = if target == player_a {
            ctx.accounts.player_b_token_account.to_account_info()
        } else {
            ctx.accounts.player_a_token_account.to_account_info()
        };

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        honest_token_account,
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            wager_amount,
            token_decimals,
        )?;

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from:      ctx.accounts.vault.to_account_info(),
                    mint:      ctx.accounts.token_mint.to_account_info(),
                    to:        ctx.accounts.treasury.to_account_info(),
                    authority: match_state_info.clone(),
                },
                seeds,
            ),
            wager_amount,
            token_decimals,
        )?;

        msg!("Match penalized! Cheater: {}", target);
    }

    emit!(MatchSettledEvent {
        match_id,
        action,
        target,
    });

    // Close the token vault and return rent to the caller
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.caller.to_account_info(),
            authority: match_state_info,
        },
        seeds,
    ))?;

    msg!("Match state and vault closed. Rent returned to caller.");

    Ok(())
}

fn verify_ed25519(
    instructions_sysvar: &AccountInfo,
    pubkey: &[u8; 32],
    message: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    let ix = load_current_index_checked(instructions_sysvar)?;

    if ix == 0 {
        return err!(CoraError::InvalidSignature);
    }

    let ed25519_ix = load_instruction_at_checked((ix - 1) as usize, instructions_sysvar)?;

    require!(
        ed25519_ix.program_id == ed25519_program::ID,
        CoraError::InvalidSignature
    );

    let data = &ed25519_ix.data;
    require!(data.len() >= 2, CoraError::InvalidSignature);

    let num_sigs = data[0] as usize;
    require!(num_sigs >= 1, CoraError::InvalidSignature);

    let header_offset = 2;
    require!(data.len() >= header_offset + 14, CoraError::InvalidSignature);

    let sig_offset = u16::from_le_bytes([data[header_offset],      data[header_offset + 1]]) as usize;
    let sig_ix_idx = u16::from_le_bytes([data[header_offset + 2],  data[header_offset + 3]]);
    let key_offset = u16::from_le_bytes([data[header_offset + 4],  data[header_offset + 5]]) as usize;
    let key_ix_idx = u16::from_le_bytes([data[header_offset + 6],  data[header_offset + 7]]);
    let msg_offset = u16::from_le_bytes([data[header_offset + 8],  data[header_offset + 9]]) as usize;
    let msg_size   = u16::from_le_bytes([data[header_offset + 10], data[header_offset + 11]]) as usize;
    let msg_ix_idx = u16::from_le_bytes([data[header_offset + 12], data[header_offset + 13]]);

    require!(
        sig_ix_idx == 0xFFFF && key_ix_idx == 0xFFFF && msg_ix_idx == 0xFFFF,
        CoraError::InvalidSignature
    );

    require!(
        data.len() >= sig_offset + 64 &&
        data.len() >= key_offset + 32 &&
        data.len() >= msg_offset + msg_size,
        CoraError::InvalidSignature
    );

    require!(&data[sig_offset..sig_offset + 64] == signature,        CoraError::InvalidSignature);
    require!(&data[key_offset..key_offset + 32] == pubkey,           CoraError::InvalidSignature);
    require!(&data[msg_offset..msg_offset + msg_size] == message,    CoraError::InvalidSignature);

    Ok(())
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [MATCH_SEED, match_state.match_id.as_ref()],
        bump = match_state.bump,
        constraint = match_state.token_mint == token_mint.key() @ CoraError::InvalidTokenMint,
        close = caller
    )]
    pub match_state: Box<Account<'info, MatchState>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, match_state.match_id.as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = match_state,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = match_state.player_a,
    )]
    pub player_a_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = match_state.player_b,
    )]
    pub player_b_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProgramConfig>>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = config.treasury_authority,
    )]
    pub treasury: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: This is the instructions sysvar, verified by address constraint
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}
