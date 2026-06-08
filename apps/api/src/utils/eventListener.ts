import { Connection, PublicKey } from '@solana/web3.js';
import { CORA_ESCROW_PROGRAM_ID } from '../config/solana';

/**
 * Anchor Event Listener — subscribes to on-chain program logs via WebSocket
 * and decodes structured events emitted by the Solana program's `emit!` macro.
 *
 * Events are identified by their 8-byte discriminator (sha256("event:<EventName>")[0..8]).
 * The discriminators are sourced from the IDL exported by the Web3 team.
 *
 * This listener is embedded in the API server process (not a standalone service)
 * and only activates when SOLANA_RPC_URL is configured.
 */

// Discriminators from solana_program.ts IDL (sha256 of "event:<EventName>")
const EVENT_DISCRIMINATORS: Record<string, number[]> = {
  MatchInitializedEvent:  [75, 64, 91, 119, 84, 109, 244, 34],
  WagerDepositedEvent:    [54, 33, 14, 83, 152, 191, 114, 255],
  MatchSettledEvent:      [56, 219, 213, 131, 79, 126, 13, 227],
  MatchRefundedEvent:     [15, 197, 212, 55, 111, 154, 77, 158],
  ConfigInitializedEvent: [22, 167, 192, 50, 220, 20, 10, 71],
  ConfigUpdatedEvent:     [245, 158, 129, 99, 60, 100, 214, 220],
};

/**
 * Matches a base64-encoded data string against known event discriminators.
 * Anchor events are emitted as program log data in base64 format.
 */
function identifyEvent(base64Data: string): string | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 8) return null;

    const disc = Array.from(buffer.subarray(0, 8));

    for (const [name, expected] of Object.entries(EVENT_DISCRIMINATORS)) {
      if (disc.every((byte, i) => byte === expected[i])) {
        return name;
      }
    }
  } catch {
    // Malformed base64 — ignore
  }
  return null;
}

/**
 * Parses the raw bytes after the 8-byte discriminator for each known event type.
 * Returns a plain object with decoded fields.
 */
function parseEventData(eventName: string, buffer: Buffer): Record<string, unknown> {
  const data = buffer.subarray(8); // skip discriminator

  switch (eventName) {
    case 'MatchInitializedEvent': {
      // match_id: [u8; 32], player_a: Pubkey, player_b: Pubkey, token_mint: Pubkey, wager_amount: u64
      const matchId = Buffer.from(data.subarray(0, 32)).toString('hex');
      const playerA = new PublicKey(data.subarray(32, 64)).toBase58();
      const playerB = new PublicKey(data.subarray(64, 96)).toBase58();
      const tokenMint = new PublicKey(data.subarray(96, 128)).toBase58();
      const wagerAmount = data.readBigUInt64LE(128).toString();
      return { matchId, playerA, playerB, tokenMint, wagerAmount };
    }

    case 'WagerDepositedEvent': {
      // match_id: [u8; 32], depositor: Pubkey, amount: u64, match_active: bool
      const matchId = Buffer.from(data.subarray(0, 32)).toString('hex');
      const depositor = new PublicKey(data.subarray(32, 64)).toBase58();
      const amount = data.readBigUInt64LE(64).toString();
      const matchActive = data[72] === 1;
      return { matchId, depositor, amount, matchActive };
    }

    case 'MatchSettledEvent': {
      // match_id: [u8; 32], action: u8, target: Pubkey
      const matchId = Buffer.from(data.subarray(0, 32)).toString('hex');
      const action = data[32];
      const target = new PublicKey(data.subarray(33, 65)).toBase58();
      return { matchId, action, target };
    }

    case 'MatchRefundedEvent': {
      // match_id: [u8; 32]
      const matchId = Buffer.from(data.subarray(0, 32)).toString('hex');
      return { matchId };
    }

    case 'ConfigInitializedEvent': {
      // admin: Pubkey, treasury_authority: Pubkey
      const admin = new PublicKey(data.subarray(0, 32)).toBase58();
      const treasuryAuthority = new PublicKey(data.subarray(32, 64)).toBase58();
      return { admin, treasuryAuthority };
    }

    case 'ConfigUpdatedEvent': {
      // admin: Pubkey, new_treasury_authority: Pubkey
      const admin = new PublicKey(data.subarray(0, 32)).toBase58();
      const newTreasuryAuthority = new PublicKey(data.subarray(32, 64)).toBase58();
      return { admin, newTreasuryAuthority };
    }

    default:
      return {};
  }
}

/**
 * Starts listening for Anchor events on the CORA program via `onLogs`.
 * Returns a subscription ID that can be used to unsubscribe.
 *
 * Anchor emits events as base64-encoded data within `Program data:` log lines.
 * We filter for our program ID, extract the data, match discriminators, and log.
 */
export function startEventListener(rpcUrl: string, wsUrl?: string): number | null {
  // Use explicit WS URL if provided; otherwise derive from HTTP URL
  const resolvedWsUrl = wsUrl || rpcUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');

  let connection: Connection;
  try {
    connection = new Connection(rpcUrl, {
      wsEndpoint: resolvedWsUrl,
      commitment: 'confirmed',
    });
  } catch (err) {
    console.error('[EventListener] Failed to create WebSocket connection:', err);
    return null;
  }

  const subscriptionId = connection.onLogs(
    CORA_ESCROW_PROGRAM_ID,
    (logInfo) => {
      if (logInfo.err) return; // Skip failed transactions

      // Anchor events appear as "Program data: <base64>" in the log lines
      for (const log of logInfo.logs) {
        if (!log.startsWith('Program data: ')) continue;

        const base64Data = log.slice('Program data: '.length);
        const eventName = identifyEvent(base64Data);
        if (!eventName) continue;

        const buffer = Buffer.from(base64Data, 'base64');
        const parsed = parseEventData(eventName, buffer);

        console.log(`[EventListener] 📡 ${eventName}`, JSON.stringify(parsed));
      }
    },
    'confirmed',
  );

  console.log(`[EventListener] Subscribed to program logs (ID: ${subscriptionId})`);
  console.log(`[EventListener] Watching for: ${Object.keys(EVENT_DISCRIMINATORS).join(', ')}`);

  return subscriptionId;
}
