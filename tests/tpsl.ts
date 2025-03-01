import * as anchor from "@coral-xyz/anchor";
import { Wallet, Program } from "@coral-xyz/anchor";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import { Tpsl } from "../target/types/tpsl";

describe("tpsl", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tpsl as Program<Tpsl>;

  const provider = anchor.getProvider();

  const connection = provider.connection;

  let wallet: Wallet;

  const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

  const SOL_PRICE_FEED_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const solUsdPriceFeedAccount = pythSolanaReceiver
    .getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID)
    .toBase58();

  const solUsdPriceFeedAccountPubkey = new PublicKey(solUsdPriceFeedAccount);

  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  const input_mint = anchor.web3.Keypair.generate();
  const output_mint = anchor.web3.Keypair.generate();

  const user = provider.publicKey;

  const user_input_ata = getAssociatedTokenAddressSync(
    input_mint.publicKey,
    user,
    false,
    TOKEN_PROGRAM_ID
  );

  const id = new anchor.BN(102342000);

  const escrow = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tpsl-escrow"),
      user.toBuffer(),
      id.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  const escrow_token_ata = getAssociatedTokenAddressSync(
    input_mint.publicKey,
    escrow,
    true,
    TOKEN_PROGRAM_ID
  );

  it("airdrop and create mint", async () => {
    let lamports = await getMinimumBalanceForRentExemptMint(connection);
    // const airdrop = await connection.requestAirdrop(user, 1000000000000000);
    // await confirm(airdrop);
    let tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: input_mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        input_mint.publicKey,
        9,
        user,
        null,
        TOKEN_PROGRAM_ID
      ),
      SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: output_mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        output_mint.publicKey,
        9,
        user,
        null,
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        user_input_ata,
        user,
        input_mint.publicKey
      ),
      createMintToInstruction(
        input_mint.publicKey,
        user_input_ata,
        user,
        1000e9
      )
    );
    await provider.sendAndConfirm(tx, [input_mint, output_mint]).then(log);
  });

  it("init tpsl escrow", async () => {
    await program.methods
      .init(id, new anchor.BN(100), new anchor.BN(19), { tp: {} })
      .accounts({
        user,
        inputMint: input_mint.publicKey,
        outputMint: output_mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()
      .then(confirm)
      .then(log);

    const account = await program.account.escrow.fetch(escrow);
    const balance = await connection.getTokenAccountBalance(escrow_token_ata);

    assert(account.id.eq(id), "Account ID mismatch");
    assert(account.amount.eq(new anchor.BN(100)), "Account amount mismatch");
    assert(account.price.eq(new anchor.BN(19)), "Account price mismatch");
    assert.deepStrictEqual(
      account.orderType,
      { tp: {} },
      "Account order type mismatch"
    );
    assert.deepStrictEqual(
      account.outputMint,
      output_mint.publicKey,
      "Account output mint mismatch"
    );

    assert.equal(balance.value.amount, "100");
  });

  it("settle escrow", async () => {
    await program.methods
      .settle(id)
      .accounts({
        user,
        inputMint: input_mint.publicKey,
        outputMint: output_mint.publicKey,
        priceUpdate: solUsdPriceFeedAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()
      .then(confirm)
      .then(log);
  });
});
