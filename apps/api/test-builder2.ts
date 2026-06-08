import { BlinkTransactionBuilder } from './src/services/BlinkTransactionBuilder.js';
import { deriveMatchId } from '@shared/escrow';
import { resolveTokenMint } from './src/config/tokens.js';


async function run() {
  const matchIdBytes = deriveMatchId('test-room');
  const mint = resolveTokenMint('SOL');
  console.log("Mint resolved:", mint);
  const tx = await BlinkTransactionBuilder.buildCreateOpenChallengeTransaction(
    'GDWqMqvY7eRVuPuqUu5HQF6mKE5jds6AQVTJkw1kzoJi',
    matchIdBytes,
    mint!,
    BigInt(100_000_000)
  );
  console.log("Success");
}
run().catch(console.error);
