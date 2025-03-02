# TPSL - Take Profit Stop Loss Program

This Anchor program allows users to create take profit (TP) and stop loss (SL) orders on the Solana blockchain. It leverages Pyth Network for price feeds and integrates with Jupiter Aggregator for swapping tokens.

## Overview

The program enables users to set up conditional orders that automatically execute when a specified price condition is met.  This is achieved by:

1.  **Initializing an Escrow:**  The user locks their input tokens into an escrow account managed by the program.
2.  **Monitoring Price:** The program uses a Pyth price feed to track the price of an asset.
3.  **Settling the Order:** When the price condition is met (take profit or stop loss), the program executes a swap using Jupiter Aggregator to convert the input tokens to the desired output tokens.

## Features

*   **Take Profit (TP) Orders:** Automatically sell tokens when the price reaches a specified target.
*   **Stop Loss (SL) Orders:** Automatically sell tokens when the price drops to a specified level, limiting potential losses.
*   **Integration with Pyth Network:** Uses real-time price feeds for accurate and reliable price data.
*   **Integration with Jupiter Aggregator:**  Executes swaps through Jupiter for optimal pricing and liquidity.

## Architecture

The program consists of the following main components:

*   **`Escrow` Account:** Stores the details of the order, including the user, input/output tokens, amount, price, and order type (TP or SL).
*   **`Init` Instruction:** Initializes the escrow account and transfers the input tokens from the user to the escrow account.
*   **`Settle` Instruction:** Checks the price against the specified condition and executes the swap if the condition is met.

## Program ID

`GyXAGe33zb1WgwrEapbzsct6tPeL713akAzHxojL9zfE`


