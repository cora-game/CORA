import { Connection, Keypair, VersionedTransaction, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { WebSocket } from 'ws';
import fs from 'fs';

// Run with: bun run scripts/test-blink-onchain.ts

const API_BASE = 'http://localhost:8080';
const WS_BASE = 'ws://localhost:8080';
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function airdrop(pubkey: string) {
  console.log(`Requesting airdrop for ${pubkey}...`);
  const sig = await connection.requestAirdrop(new PublicKey(pubkey), 2 * 1e9); // 2 SOL
  await connection.confirmTransaction(sig, 'confirmed');
  console.log(`Airdrop complete!`);
}

import { PublicKey } from '@solana/web3.js';

async function run() {
  console.log("==========================================");
  console.log(" Blink True Flow: End-to-End On-Chain Test");
  console.log("==========================================\n");

  // 1. Setup Wallets
  // const creator = Keypair.generate();
  // const challenger = Keypair.generate();

  // console.log(`Creator Wallet:    ${creator.publicKey.toBase58()}`);
  // console.log(`Challenger Wallet: ${challenger.publicKey.toBase58()}\n`);

  // console.log("Funding wallets on Devnet...");
  // await airdrop(creator.publicKey.toBase58());
  // await airdrop(challenger.publicKey.toBase58());
  // console.log("Wallets funded.\n");



  const creator = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('./keys/creator.json', 'utf-8')))
  );
  const challenger = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('./keys/challenger.json', 'utf-8')))
  );

  console.log(`Creator Wallet:    ${creator.publicKey.toBase58()}`);
  console.log(`Challenger Wallet: ${challenger.publicKey.toBase58()}\n`);

  // Verify balances before starting
  const creatorBalance = await connection.getBalance(creator.publicKey);
  const challengerBalance = await connection.getBalance(challenger.publicKey);
  console.log(`Creator balance:    ${creatorBalance / 1e9} SOL`);
  console.log(`Challenger balance: ${challengerBalance / 1e9} SOL`);

  if (creatorBalance < 0.5 * 1e9 || challengerBalance < 0.5 * 1e9) {
    throw new Error('One or both wallets have insufficient balance. Run: solana airdrop 2 <pubkey>');
  }
  console.log('Balances OK\n');

  // 2. Creator initiates the match
  console.log("STEP 1: Creator calls POST /match/private");
  const createRes = await fetch(`${API_BASE}/match/private`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: creator.publicKey.toBase58(),
      tokenMint: 'SOL',
      wagerAmount: 100000000, // 0.1 SOL in lamports
    }),
  });
  const createText = await createRes.text();
  if (!createRes.ok) throw new Error(`Create failed (${createRes.status}): ${createText}`);
  const createData = JSON.parse(createText);

  const { roomId, blinkUrl, transaction: b64CreatorTx } = createData;
  console.log(`Room ID: ${roomId}`);
  console.log(`Blink URL: ${blinkUrl}`);
  
  // 3. Creator signs and sends create_open_challenge
  console.log("\nSTEP 2: Creator signs and sends create_open_challenge on-chain");
  const creatorTxBuffer = Buffer.from(b64CreatorTx, 'base64');
  const creatorTx = Transaction.from(creatorTxBuffer);
  
  // The backend didn't set recent blockhash, so we do it here (like Phantom would)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  creatorTx.recentBlockhash = blockhash;
  creatorTx.feePayer = creator.publicKey;
  creatorTx.sign(creator);

  const creatorSig = await connection.sendRawTransaction(creatorTx.serialize());
  console.log(`Transaction sent! Signature: ${creatorSig}`);
  console.log("Waiting for confirmation (this takes a few seconds)...");
  await connection.confirmTransaction({ signature: creatorSig, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log("Confirmed on-chain!\n");

  // 4. Creator confirms the room with the backend
  console.log("STEP 3: Creator calls POST /match/private/confirm");
  const confirmRes = await fetch(`${API_BASE}/match/private/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      address: creator.publicKey.toBase58(),
      signature: creatorSig,
      tokenMint: 'SOL',
      wagerAmount: 100000000,
    }),
  });
  const confirmData = await confirmRes.json();
  if (!confirmRes.ok) throw new Error(`Confirm failed: ${JSON.stringify(confirmData)}`);
  console.log(`Room confirmed! DB Status: ${confirmData.status}\n`);

  // 5. Challenger views the Blink
  console.log("STEP 4: Challenger views the Blink URL (simulating dial.to)");
  const blinkMetaRes = await fetch(`${API_BASE}/api/actions/challenge?roomId=${roomId}`);
  const blinkMeta = await blinkMetaRes.json();
  console.log(`Blink Title: ${blinkMeta.title}\n`);

  // 6. Challenger accepts the Blink
  console.log("STEP 5: Challenger clicks 'Accept Challenge' on the Blink");
  const acceptRes = await fetch(`${API_BASE}/api/actions/challenge?roomId=${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: challenger.publicKey.toBase58() }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok) throw new Error(`Accept failed: ${JSON.stringify(acceptData)}`);
  
  const b64ChallengerTx = acceptData.transaction;
  console.log(`Message: ${acceptData.message}`);

  // 7. Challenger signs and sends accept_challenge
  console.log("\nSTEP 6: Challenger signs and sends accept_challenge on-chain");
  const challengerTxBuffer = Buffer.from(b64ChallengerTx, 'base64');
  const challengerTx = Transaction.from(challengerTxBuffer);
  
  const latestBlockhash2 = await connection.getLatestBlockhash();
  challengerTx.recentBlockhash = latestBlockhash2.blockhash;
  challengerTx.feePayer = challenger.publicKey;
  challengerTx.sign(challenger);

  const challengerSig = await connection.sendRawTransaction(challengerTx.serialize());
  console.log(`Transaction sent! Signature: ${challengerSig}`);
  console.log("Waiting for confirmation...");
  await connection.confirmTransaction({ signature: challengerSig, ...latestBlockhash2 }, 'confirmed');
  console.log("Confirmed on-chain!\n");

  // 8. Both players join the WebSocket
  console.log("STEP 7: Both players connect to the WebSocket to start playing");
  
  const creatorWs = new WebSocket(`${WS_BASE}/match/${roomId}?address=${creator.publicKey.toBase58()}`);
  const challengerWs = new WebSocket(`${WS_BASE}/match/${roomId}?address=${challenger.publicKey.toBase58()}`);

  const waitForPlaying = (ws: WebSocket, role: string) => new Promise<void>((resolve) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'gameStateUpdate' && msg.payload.status === 'playing') {
        console.log(`[${role}] Game is PLAYING!`);
        resolve();
      }
    });
  });

  await Promise.all([
    waitForPlaying(creatorWs, 'Creator'),
    waitForPlaying(challengerWs, 'Challenger')
  ]);

  console.log("\n✅ E2E Test Completed Successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
