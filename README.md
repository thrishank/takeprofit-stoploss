# TPSL - Take Profit Stop Loss Program

This Anchor program allows users to create take profit (TP) and stop loss (SL) orders on the Solana blockchain. It leverages Pyth Network for price feeds and integrates with Jupiter Aggregator for swapping tokens.

## Overview

The program enables users to set up conditional orders that automatically execute when a specified price condition is met. This is achieved by:

1. **Initializing an Escrow:** The user locks their input tokens into an escrow account managed by the program.
2. **Monitoring Price:** The program uses a Pyth price feed to track the price of an asset.
3. **Settling the Order:** When the price condition is met (take profit or stop loss), the program executes a swap using Jupiter Aggregator to convert the input tokens to the desired output tokens.

## Features

- **Take Profit (TP) Orders:** Automatically sell tokens when the price reaches a specified target.
- **Stop Loss (SL) Orders:** Automatically sell tokens when the price drops to a specified level, limiting potential losses.
- **Integration with Pyth Network:** Uses real-time price feeds for accurate and reliable price data.
- **Integration with Jupiter Aggregator:** Executes swaps through Jupiter for optimal pricing and liquidity.

## Architecture

The program consists of the following main components:

- **`Escrow` Account:** Stores the details of the order, including the user, input/output tokens, amount, price, and order type (TP or SL).
- **`Init` Instruction:** Initializes the escrow account and transfers the input tokens from the user to the escrow account.
- **`Settle` Instruction:** Checks the price against the specified condition and executes the swap if the condition is met.

## Program ID

`GyXAGe33zb1WgwrEapbzsct6tPeL713akAzHxojL9zfE`

## Client Code

1. Create a Take Profit Order

```typescript
const instruction = await program.methods
  .init(id, amount, price, { tp: {} })
  .accounts({
    user: wallet.publicKey,
    inputMint: input_mint,
    outputMint: output_mint,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .instruction();

const tx = new Transaction().add(instruction);

const signature = await connection.sendTransaction(tx, [wallet]);
```

2. swap tokens

```typescript
// SOL/USDT Example 
const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const solUsdPriceFeedAccount = pythSolanaReceiver
  .getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID)
  .toBase58();

const instruction = await program.methods
  .settle(id)
  .accounts({
    user: wallet.publicKey,
    inputMint: input_mint,
    outputMint: output_mint,
    priceUpdate: solUsdPriceFeedAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .instruction();

const ws = new WebSocket("wss://stream.binance.com/ws/solusdt@trade");

ws.on("open", () => {
  console.log("Connected to Binance SOL/USDT trade stream");
});

ws.on("message", async (data) => {
  try {
    const message = JSON.parse(data);
    console.log(message.p);
    if (parseFloat(message.p) > 200) {
      const tx = new Transaction().add(instruction);

      const signature = await connection.sendTransaction(tx, [wallet]);
      console.log("Transaction sent:", signature);
    }
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
});

ws.on("close", () => {
  console.log("Disconnected from Binance SOL/USDT trade stream");
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});
```
