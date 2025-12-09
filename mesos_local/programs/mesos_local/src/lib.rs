use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn},
};

declare_id!("DfaszuQVod1HEeqqEY8vDkXbGyRgMxSaZHbkjo9JqWT7");

// Constants
pub const USDC_TO_VOUCHER_RATE: u64 = 4; // 1 USDC = 4 PLN
pub const VAULT_SEED: &[u8] = b"vault";
pub const ROLE_SEED: &[u8] = b"role";
pub const VOUCHER_MINT_SEED: &[u8] = b"voucher_mint";

// Devnet USDC address
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

/// Role types for access control
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Role {
    Client,   // Can send PLNLOG to merchants only
    Merchant, // Can receive PLNLOG from clients, can burn/settle
}

#[program]
pub mod mesos_local {
    use super::*;

    /// Initialize the vault with voucher token mint
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.voucher_mint = ctx.accounts.voucher_mint.key();
        vault.total_usdc_deposited = 0;
        vault.total_voucher_minted = 0;
        vault.bump = ctx.bumps.vault;
        vault.voucher_mint_bump = ctx.bumps.voucher_mint;
        
        msg!("Vault initialized. voucher mint: {}", ctx.accounts.voucher_mint.key());
        Ok(())
    }

    /// Add a client to the role registry
    pub fn add_client(ctx: Context<AddRole>, address: Pubkey) -> Result<()> {
        let role_entry = &mut ctx.accounts.role_entry;
        role_entry.address = address;
        role_entry.role = Role::Client;
        role_entry.is_active = true;
        role_entry.added_at = Clock::get()?.unix_timestamp;
        role_entry.bump = ctx.bumps.role_entry;
        
        msg!("Client {} registered", address);
        Ok(())
    }

    /// Add a merchant to the role registry
    pub fn add_merchant(ctx: Context<AddRole>, address: Pubkey) -> Result<()> {
        let role_entry = &mut ctx.accounts.role_entry;
        role_entry.address = address;
        role_entry.role = Role::Merchant;
        role_entry.is_active = true;
        role_entry.added_at = Clock::get()?.unix_timestamp;
        role_entry.bump = ctx.bumps.role_entry;
        
        msg!("Merchant {} registered", address);
        Ok(())
    }

    /// Remove an address from the role registry
    pub fn remove_role(ctx: Context<RemoveRole>) -> Result<()> {
        let role_entry = &mut ctx.accounts.role_entry;
        role_entry.is_active = false;
        
        msg!("Role removed for {}", role_entry.address);
        Ok(())
    }

    /// Deposit USDC and mint voucher vouchers at 1:4 rate
    pub fn deposit_usdc(ctx: Context<DepositUsdc>, usdc_amount: u64) -> Result<()> {
        require!(usdc_amount > 0, MesosError::InvalidAmount);
        
        // Transfer USDC from user to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            usdc_amount,
        )?;
        
        // Calculate voucher amount (1:4 rate)
        let voucher_amount = usdc_amount.checked_mul(USDC_TO_VOUCHER_RATE).ok_or(MesosError::Overflow)?;
        
        // Mint voucher to user - use voucher_mint as signer
        let vault_key = ctx.accounts.vault.key();
        let voucher_mint_bump = ctx.accounts.vault.voucher_mint_bump;
        let seeds = &[VOUCHER_MINT_SEED, vault_key.as_ref(), &[voucher_mint_bump]];
        let signer_seeds = &[&seeds[..]];
        
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.voucher_mint.to_account_info(),
                    to: ctx.accounts.user_voucher_account.to_account_info(),
                    authority: ctx.accounts.voucher_mint.to_account_info(),
                },
                signer_seeds,
            ),
            voucher_amount,
        )?;
        
        // Update vault state
        let vault = &mut ctx.accounts.vault;
        vault.total_usdc_deposited = vault.total_usdc_deposited.checked_add(usdc_amount).ok_or(MesosError::Overflow)?;
        vault.total_voucher_minted = vault.total_voucher_minted.checked_add(voucher_amount).ok_or(MesosError::Overflow)?;
        
        msg!("Deposited {} USDC, minted {} voucher", usdc_amount, voucher_amount);
        Ok(())
    }

    /// Transfer voucher with role-based access control (THE COMPLIANCE GATE)
    pub fn transfer_pln(ctx: Context<TransferPln>, amount: u64) -> Result<()> {
        require!(amount > 0, MesosError::InvalidAmount);
        
        // ROLE-BASED ACCESS CONTROL:
        // 1. Sender must be an active Client
        require!(ctx.accounts.sender_role.is_active, MesosError::SenderNotRegistered);
        require!(ctx.accounts.sender_role.role == Role::Client, MesosError::OnlyClientCanSend);
        
        // 2. Recipient must be an active Merchant
        require!(ctx.accounts.recipient_role.is_active, MesosError::RecipientNotRegistered);
        require!(ctx.accounts.recipient_role.role == Role::Merchant, MesosError::OnlyMerchantCanReceive);
        
        // Transfer voucher from client to merchant
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_voucher_account.to_account_info(),
                    to: ctx.accounts.recipient_voucher_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;
        
        msg!("Transferred {} voucher from client to merchant", amount);
        Ok(())
    }

    /// Settle: Merchant burns voucher to receive USDC
    pub fn settle(ctx: Context<Settle>, voucher_amount: u64) -> Result<()> {
        require!(voucher_amount > 0, MesosError::InvalidAmount);
        
        // Only merchants can settle
        require!(ctx.accounts.merchant_role.is_active, MesosError::NotRegistered);
        require!(ctx.accounts.merchant_role.role == Role::Merchant, MesosError::OnlyMerchantCanSettle);
        
        // Calculate USDC amount (reverse 1:4 rate)
        let usdc_amount = voucher_amount.checked_div(USDC_TO_VOUCHER_RATE).ok_or(MesosError::Overflow)?;
        require!(usdc_amount > 0, MesosError::AmountTooSmall);
        
        // Burn voucher from merchant
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.voucher_mint.to_account_info(),
                    from: ctx.accounts.merchant_voucher_account.to_account_info(),
                    authority: ctx.accounts.merchant.to_account_info(),
                },
            ),
            voucher_amount,
        )?;
        
        // Transfer USDC from vault to merchant
        let authority_key = ctx.accounts.vault.authority;
        let vault_bump = ctx.accounts.vault.bump;
        let seeds = &[VAULT_SEED, authority_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.merchant_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            usdc_amount,
        )?;
        
        // Update vault state
        let vault = &mut ctx.accounts.vault;
        vault.total_usdc_deposited = vault.total_usdc_deposited.checked_sub(usdc_amount).ok_or(MesosError::Underflow)?;
        vault.total_voucher_minted = vault.total_voucher_minted.checked_sub(voucher_amount).ok_or(MesosError::Underflow)?;
        
        msg!("Settled {} voucher for {} USDC", voucher_amount, usdc_amount);
        Ok(())
    }
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    /// voucher token mint
    #[account(
        init,
        payer = authority,
        seeds = [VOUCHER_MINT_SEED, vault.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = voucher_mint,
        mint::freeze_authority = voucher_mint,
    )]
    pub voucher_mint: Account<'info, Mint>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AddRole<'info> {
    #[account(
        seeds = [VAULT_SEED, authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + RoleEntry::INIT_SPACE,
        seeds = [ROLE_SEED, vault.key().as_ref(), address.as_ref()],
        bump
    )]
    pub role_entry: Account<'info, RoleEntry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveRole<'info> {
    #[account(
        seeds = [VAULT_SEED, authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        mut,
        seeds = [ROLE_SEED, vault.key().as_ref(), role_entry.address.as_ref()],
        bump = role_entry.bump,
    )]
    pub role_entry: Account<'info, RoleEntry>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub voucher_mint: Account<'info, Mint>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = voucher_mint,
        associated_token::authority = user,
    )]
    pub user_voucher_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferPln<'info> {
    pub vault: Account<'info, Vault>,
    
    pub voucher_mint: Account<'info, Mint>,
    
    /// Role entry for the sender - must be Client
    pub sender_role: Account<'info, RoleEntry>,
    
    /// Role entry for the recipient - must be Merchant
    pub recipient_role: Account<'info, RoleEntry>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: Recipient validated by recipient_role
    pub recipient: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub sender_voucher_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = voucher_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_voucher_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub voucher_mint: Account<'info, Mint>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    /// Role entry for merchant - must be active Merchant
    pub merchant_role: Account<'info, RoleEntry>,
    
    #[account(mut)]
    pub merchant: Signer<'info>,
    
    #[account(mut)]
    pub merchant_voucher_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = merchant,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant,
    )]
    pub merchant_usdc_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ============ State ============

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub voucher_mint: Pubkey,
    pub total_usdc_deposited: u64,
    pub total_voucher_minted: u64,
    pub bump: u8,
    pub voucher_mint_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RoleEntry {
    pub address: Pubkey,
    pub role: Role,
    pub is_active: bool,
    pub added_at: i64,
    pub bump: u8,
}

// ============ Errors ============

#[error_code]
pub enum MesosError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Amount too small for conversion")]
    AmountTooSmall,
    #[msg("Sender is not registered")]
    SenderNotRegistered,
    #[msg("Recipient is not registered")]
    RecipientNotRegistered,
    #[msg("Only clients can send PLNLOG")]
    OnlyClientCanSend,
    #[msg("Only merchants can receive PLNLOG")]
    OnlyMerchantCanReceive,
    #[msg("Only merchants can settle")]
    OnlyMerchantCanSettle,
    #[msg("Address is not registered")]
    NotRegistered,
}
