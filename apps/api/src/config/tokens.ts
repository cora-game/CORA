import { PublicKey } from '@solana/web3.js';

export type SolanaCluster = 'devnet' | 'mainnet';

export const TOKEN_MINTS_BY_CLUSTER: Record<SolanaCluster, Record<string, string>> = {
  devnet: {
    SOL: 'So11111111111111111111111111111111111111112',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  },
  mainnet: {
    SOL: 'So11111111111111111111111111111111111111112',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
};

export const DEVNET_TOKEN_MINTS = TOKEN_MINTS_BY_CLUSTER.devnet;
export const MAINNET_TOKEN_MINTS = TOKEN_MINTS_BY_CLUSTER.mainnet;

export function resolveTokenMint(input: string, cluster: SolanaCluster = 'devnet'): string | null {
  const mapped = TOKEN_MINTS_BY_CLUSTER[cluster][input.toUpperCase()];
  if (mapped) return mapped;

  try {
    new PublicKey(input);
    return input;
  } catch {
    return null;
  }
}
