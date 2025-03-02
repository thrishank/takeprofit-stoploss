import { PublicKey } from "@solana/web3.js";
import { Tpsl } from "../target/types/tpsl";
import IDL from "../target/idl/tpsl.json";
import fs from "fs";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { Keypair } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com");

const input_mint = new PublicKey(
  "AnEwe8NZETPxKSeJbqu14ue2NmctR4jnwsJYo6RbLCJU"
);

const output_mint = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

const secretKeyString = fs.readFileSync("/Users/thris/.config/solana/id.json", {
  encoding: "utf-8",
});
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));

const wallet = Keypair.fromSecretKey(secretKey);

async function init() {
  // sell USDC to SOL when the price of SOL is greater than 200

  const provider = new AnchorProvider(connection, new Wallet(wallet), {});
  const program = new Program<Tpsl>(IDL as Tpsl, provider);

  const id = new BN(234);

  /* 
  const escrow = PublicKey.findProgramAddressSync(
    [
      Buffer.from("tpsl-escrow"),
      wallet.publicKey.toBuffer(),
      id.toArrayLike(Buffer, "le", 8),
    ],
    programId
  )[0];
  */

  const amount = new BN(100 * 1e9);
  const price = new BN(200);

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

  const block = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    ...block,
  });
  console.log(signature);
}

init();
