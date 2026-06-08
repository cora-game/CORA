import { GoldRushClient } from '@covalenthq/client-sdk';
import { MAINNET_TOKEN_MINTS, resolveTokenMint } from '../config/tokens';

// NOTE: Covalent only indexes solana-mainnet. Devnet balances won't appear,
// but pricing data and API-key validation will work correctly.
const chainId = 'solana-mainnet';

// Lazily construct the GoldRush client on first use instead of at import time.
// Constructing it eagerly meant a missing/invalid key could throw before the HTTP
// server bound, silently preventing the API from ever starting. Now a bad key just
// disables pricing/balance features (callers fall back gracefully) and the server
// still boots.
let goldRushClient: GoldRushClient | null = null;
let goldRushInitFailed = false;

function getGoldRushClient(): GoldRushClient | null {
  if (goldRushClient) return goldRushClient;
  if (goldRushInitFailed) return null;

  const apiKey = process.env.GOLDRUSH_API_KEY;
  if (!apiKey) {
    console.warn('[GoldRush] GOLDRUSH_API_KEY not set — pricing/balance features disabled.');
    goldRushInitFailed = true;
    return null;
  }

  try {
    goldRushClient = new GoldRushClient(apiKey);
    return goldRushClient;
  } catch (err) {
    console.error('[GoldRush] Failed to initialize client:', err instanceof Error ? err.message : err);
    goldRushInitFailed = true;
    return null;
  }
}

export interface WalletPlayability {
  playable: boolean;
  reason?: string;
  tokenBalance?: string;
  requiredBalance?: string;
  lastCheckedAt?: string;
  reliable?: boolean;
}

export interface MatchHistoryItem {
  id: string;
  signature: string;
  timestamp: string;
  arenaId: string;
  token: string;
  wagerUsd?: string;
  result?: "win" | "loss" | "draw" | "unknown";
  opponent?: string;
  settlementStatus?: "settled" | "pending" | "failed" | "unknown";
  explorerUrl?: string;
}

/**
 * Check if the wallet holds >= a specific amount of the given token to play.
 * Default required amount could be 1 unit (1 * 10^decimals).
 */
export async function getWalletPlayability(
  address: string,
  _arenaId: string,
  tokenMint: string
): Promise<WalletPlayability> {
  const client = getGoldRushClient();
  if (!client) {
    return {
      playable: false,
      reason: 'Balance service unavailable',
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  try {
    const res = await client.BalanceService.getTokenBalancesForWalletAddress(chainId, address, {
      quoteCurrency: 'USD'
    });

    if (res.error) {
      return {
        playable: false,
        reason: `Covalent API error: ${res.error_message}`,
        reliable: false,
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const items = res.data?.items || [];
    
    // Convert to lowercase for safer comparison (sometimes mints are returned differently, though base58 is case sensitive in solana).
    // Usually Covalent for solana returns the contract_address.
    const tokenData = items.find(item => item.contract_address === tokenMint || item.contract_ticker_symbol?.toUpperCase() === tokenMint.toUpperCase());

    const balance = tokenData?.balance || 0n;
    // Let's assume the required balance is at least some minimal wager like 0.1 tokens.
    // For simplicity, we just verify they have > 0 right now, but you could parameterize this.
    const requiredBalance = 1n; // At least 1 wei/lamport
    
    const playable = balance >= requiredBalance;

    return {
      playable,
      reason: playable ? undefined : "Insufficient token balance",
      tokenBalance: balance.toString(),
      requiredBalance: requiredBalance.toString(),
      lastCheckedAt: new Date().toISOString(),
      reliable: true,
    };
  } catch (err: unknown) {
    console.error('[GoldRush] getWalletPlayability error:', err instanceof Error ? err.message : err);
    return {
      playable: false,
      reason: 'Failed to fetch balance',
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fetch the USD price of a specific token mint.
 *
 * Workaround: Covalent's PricingService lowercases Solana base58 addresses,
 * breaking lookups. Instead, we query a known high-balance wallet via
 * BalanceService and read the `quote_rate` field for the target token.
 */
// Reverse lookup: mint address → ticker symbol for fallback matching
const MINT_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(MAINNET_TOKEN_MINTS).map(([symbol, addr]) => [addr, symbol]),
);

const PRICE_PROBE_WALLET = 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg'; // Solana Labs wallet
export async function getTokenPriceUsd(tokenMint: string): Promise<number | null> {
  const mint = resolveTokenMint(tokenMint, 'mainnet') ?? tokenMint;
  const symbol = MINT_TO_SYMBOL[mint] ?? tokenMint.toUpperCase();
  const client = getGoldRushClient();
  if (!client) return null;
  try {
    const res = await client.BalanceService.getTokenBalancesForWalletAddress(
      chainId,
      PRICE_PROBE_WALLET,
      { quoteCurrency: 'USD' },
    );
    if (res.error || !res.data?.items) return null;

    // Match by address (case-insensitive, SDK lowercases base58) or ticker symbol
    const mintLower = mint.toLowerCase();
    const token = res.data.items.find(
      (item) =>
        item.contract_address?.toLowerCase() === mintLower ||
        item.contract_ticker_symbol?.toUpperCase() === symbol,
    );
    return token?.quote_rate ?? null;
  } catch (err: unknown) {
    console.error('[GoldRush] getTokenPriceUsd error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch the USD value of a specific wager amount.
 * @param tokenMint The SPL token mint address or symbol
 * @param wagerAmount Base unit amount (e.g. lamports)
 * @param decimals Decimals of the token (default 9 for SOL)
 */
export async function getWagerUsdValue(tokenMint: string, wagerAmount: bigint, decimals: number = 9): Promise<string | undefined> {
  const price = await getTokenPriceUsd(tokenMint);
  if (price === null) return undefined;

  // Convert wager amount to human readable format first
  const amountHuman = Number(wagerAmount) / Math.pow(10, decimals);
  const usdValue = amountHuman * price;
  
  return usdValue.toFixed(2);
}

// ----------------- Mocked Endpoints -----------------

function generateMockHistory(arenaId: string, token: string, opponentPrefix: string): MatchHistoryItem[] {
  const now = Date.now();
  return [
    {
      id: `${arenaId}-recent-1`,
      signature: "5R6q...J8k2",
      timestamp: new Date(now - 1000 * 60 * 38).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.50",
      result: "win",
      opponent: `${opponentPrefix}1`,
      settlementStatus: "settled",
    },
    {
      id: `${arenaId}-recent-2`,
      signature: "7Nzf...Q2br",
      timestamp: new Date(now - 1000 * 60 * 95).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.50",
      result: "loss",
      opponent: `${opponentPrefix}2`,
      settlementStatus: "settled",
    },
    {
      id: `${arenaId}-recent-3`,
      signature: "4ddP...rK61",
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.00",
      result: "unknown",
      opponent: `${opponentPrefix}3`,
      settlementStatus: "pending",
    },
  ];
}

export async function getWalletHistory(): Promise<MatchHistoryItem[]> {
  // Stubbed response as requested by the user
  return generateMockHistory("arena-global", "SOL", "opp-");
}

export async function getArenaHistory(arenaId: string): Promise<MatchHistoryItem[]> {
  // Stubbed response as requested by the user
  return generateMockHistory(arenaId, "SOL", "plyr-");
}
