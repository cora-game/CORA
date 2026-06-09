import { formatEther } from 'viem';
import { CORA_ESCROW_ABI, ESCROW_ADDRESS, hasEscrowConfigured, wsPublicClient } from '../config/chain';

/**
 * CoraEscrow event listener — subscribes to the contract's events on Base Sepolia
 * via viem's `watchContractEvent` (WebSocket transport, or HTTP polling fallback).
 *
 * Replaces the Solana `onLogs` + Anchor base64/discriminator decoding. viem
 * decodes events from the ABI for us.
 *
 * Embedded in the API process; only activates when the escrow address is set.
 */
export function startEventListener(): (() => void) | null {
  if (!hasEscrowConfigured) {
    console.log('[EventListener] Skipped — ESCROW_CONTRACT_ADDRESS not configured.');
    return null;
  }

  const unwatch = wsPublicClient.watchContractEvent({
    address: ESCROW_ADDRESS,
    abi: CORA_ESCROW_ABI,
    onLogs: (logs) => {
      for (const log of logs) {
        const name = (log as { eventName?: string }).eventName;
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        const pretty: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(args)) {
          if (typeof v === 'bigint') {
            pretty[k] = k.toLowerCase().includes('wager') || k.toLowerCase().includes('amount')
              ? `${formatEther(v)} ETH`
              : v.toString();
          } else {
            pretty[k] = v;
          }
        }
        console.log(`[EventListener] 📡 ${name ?? 'UnknownEvent'}`, JSON.stringify(pretty));
      }
    },
    onError: (err) => {
      console.error('[EventListener] Subscription error:', err);
    },
  });

  console.log(`[EventListener] Subscribed to CoraEscrow events at ${ESCROW_ADDRESS}`);
  return unwatch;
}
