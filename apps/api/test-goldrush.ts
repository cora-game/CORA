// test-goldrush.ts
import { getTokenPriceUsd, getWalletPlayability } from './src/services/goldrush';

const wallet = process.argv[2] || 'YOUR_DEVNET_WALLET';

const price = await getTokenPriceUsd('SOL');
console.log('SOL price USD:', price);

const playability = await getWalletPlayability(wallet, 'test', 'SOL');
console.log('Playability:', playability);
