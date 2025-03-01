use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked}};
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use jupiter_aggregator::program::Jupiter;

use std::str::FromStr;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("GyXAGe33zb1WgwrEapbzsct6tPeL713akAzHxojL9zfE");

declare_program!(jupiter_aggregator);

pub const SOL_USDC_FEED: &str = "5mXfTYitRFsWPhdJfp2fc8N6hK8cw6NB5jAYpronQasj";

#[program]
pub mod tpsl {

    use super::*;

    pub fn init(ctx: Context<Init>, id: u64, amount: u64, price: i64, order_type: OrderType) -> Result<()> {
        ctx.accounts.escrow.set_inner(Escrow {
            user: ctx.accounts.user.key(),
            id,
            amount,
            price,  
            order_type,
            input_mint: ctx.accounts.input_mint.key(),
            output_mint: ctx.accounts.output_mint.key(),
        });

        let transfer_token_accounts = TransferChecked {
            from: ctx.accounts.user_input_ata.to_account_info(),
            to: ctx.accounts.escrow_input_ata.to_account_info(),
            mint: ctx.accounts.input_mint.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_token_accounts),
            amount,
            ctx.accounts.input_mint.decimals
        )

    }

    pub fn settle(ctx: Context<Settle>, _id: u64) -> Result<()> {

        let escrow = &ctx.accounts.escrow;

        let price_update = &mut ctx.accounts.price_update;
        pub const MAXIMUM_AGE: u64 = 100; // allow price feed 100 sec old, to avoid stale price feed errors
        let sol_feed_id = get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")?; 

        let price = price_update.get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &sol_feed_id)?.price;

        msg!("Price: {}", price);
         
        if escrow.order_type == OrderType::TP {
            if price < escrow.price {
                return Err(ErrorCode::PriceTooLow.into());
            }
            swap(ctx, vec![0x00]);
        } else if escrow.order_type == OrderType::SL {
            if price > escrow.price {
                return Err(ErrorCode::PriceTooHigh.into());
            }
            swap(ctx, vec![0x01]);
        } else {
            return Err(ErrorCode::InvalidOrderType.into());
        }

        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct Init<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub input_mint: InterfaceAccount<'info, Mint>,

    pub output_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = input_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_input_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = user,
        space = Escrow::SIZE,
        seeds = [b"tpsl-escrow", user.key().as_ref(), id.to_le_bytes().as_ref()],
        bump 
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = user,
        associated_token::mint = input_mint,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub escrow_input_ata: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(_id: u64)]
pub struct Settle<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub input_mint: InterfaceAccount<'info, Mint>, 
    pub output_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"tpsl-escrow", user.key().as_ref(), _id.to_le_bytes().as_ref()],
        bump,
        close = user
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = input_mint,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub escrow_input_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = output_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_output_ata: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    pub price_update: Account<'info, PriceUpdateV2>,
    // pub jupiter_program: Program<'info, Jupiter>,
}


#[account]
pub struct Escrow {
    user: Pubkey,
    input_mint: Pubkey,
    output_mint: Pubkey,
    id: u64,
    amount: u64,
    price: i64,
    order_type: OrderType,
}

#[derive(AnchorSerialize, AnchorDeserialize,  Clone, Copy, PartialEq, Eq)]
pub enum OrderType {
    TP,
    SL,
}

impl Escrow {
    const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 ; // Discriminator + 3 * Pubkey + u64 + u64 + u64 + OrderType 
}

#[error_code]
pub enum ErrorCode {
    #[msg("Price is below the take profit limit")]
    PriceTooLow,

    #[msg("Price is above the stop loss limit")]
    PriceTooHigh,

    #[msg("Invalid order type")]
    InvalidOrderType
}

pub fn swap (ctx: Context<Settle>, swap_data: Vec<u8>) {
    let accounts: Vec<AccountMeta> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| {
            let is_signer = acc.key == &ctx.accounts.escrow.key();
            AccountMeta {
                pubkey: *acc.key,
                is_signer,
                is_writable: acc.is_writable,
            }
        })
        .collect();

    let accounts_infos: Vec<AccountInfo> = ctx
        .remaining_accounts
        .iter()
        .map(|acc| AccountInfo { ..acc.clone() })
        .collect();

    let signer_seeds: &[&[&[u8]]] = &[&[b"tspl-escrow", &[ctx.bumps.escrow]]];

    invoke_signed(
    &Instruction {
        program_id: Pubkey::from_str("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4").unwrap(),
        accounts,
        data: swap_data,
    },
    &accounts_infos,
    signer_seeds,
    ).unwrap();

}
