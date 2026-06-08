import { BlinkTransactionBuilder } from './src/services/BlinkTransactionBuilder.js';
import { deriveMatchId } from '@shared/escrow';

async function run() {
  const matchIdBytes = deriveMatchId('test-room');
  const tx = await BlinkTransactionBuilder.buildCreateOpenChallengeTransaction(
    'GDWqMqvY7eRVuPuqUu5HQF6mKE5jds6AQVTJkw1kzoJi',
    matchIdBytes,
    'SOL',
    BigInt(100_000_000)
  );
  console.log("Success");
}
run().catch(console.error);
