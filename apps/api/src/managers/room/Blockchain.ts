import { formatEther } from 'viem';
import {
  initializeMatchOnChain,
  serverAddress,
  signSettlementAuthorization,
  submitRefundTransaction,
  submitSettlementTransaction,
} from '../../utils/settlement';
import { SETTLEMENT_ACTION, resolveToken, NATIVE_ETH_ADDRESS } from '@shared/escrow';
import { Room } from './types';
import type { RoomManager } from '../RoomManager';
import type { WsMessage } from '@shared/websocket';

export type SettlementResult =
  | { ok: true; signature?: string }
  | { ok: false; error: unknown };

/**
 * On-chain settlement for the CoraEscrow contract on Base Sepolia.
 *
 * Gameplay is fully server-authoritative (the game engine). This layer only
 * moves the escrowed ETH on a finished match: pay the winner, penalize a
 * cheater, or refund a draw/error. The MagicBlock Ephemeral-Rollup battle layer
 * that used to live here was removed in the Base migration — there is no EVM
 * equivalent, and the engine already ran authoritatively.
 */
export class Blockchain {
  constructor(private manager: RoomManager) {}

  /**
   * Creates the match on-chain (server-only) so both players can deposit ETH.
   * Fire-and-forget: called when a paired room enters the deposit phase. Bot
   * rooms (no escrow) and zero-wager rooms are skipped.
   */
  public initializeOnChainMatch(room: Room): void {
    if (room.roomType === 'bot') return;
    if (!room.playerA || !room.playerB || !room.wagerAmount || room.wagerAmount <= 0n) return;

    const tokenAddress = resolveToken(room.tokenMint)?.address ?? NATIVE_ETH_ADDRESS;
    initializeMatchOnChain(room.matchId, tokenAddress, room.wagerAmount, room.playerA, room.playerB)
      .then((tx) => console.log(`[RoomBlockchain] initializeMatch for ${room.id} (${room.tokenMint}): ${tx}`))
      .catch((err) => console.error(`[RoomBlockchain] initializeMatch failed for ${room.id}:`, err));
  }

  /** Compute the human-readable ETH value of the wager and push it to clients. */
  public fetchWagerEth(room: Room): void {
    if (!room.wagerAmount) return;
    try {
      room.wagerEthValue = formatEther(room.wagerAmount);
      if (this.manager.store.getRoom(room.id)) {
        this.manager.network.broadcastGameState(room);
      }
    } catch (e) {
      console.error('[RoomBlockchain] Failed to format wager ETH value:', e);
    }
  }

  /**
   * Settles a normal match: pays the winner 97.5% of the pool, 2.5% fee to
   * treasury. Signs the EIP-712 authorization and submits the tx server-side.
   */
  public async settleMatch(room: Room, winnerAddress: string): Promise<SettlementResult> {
    const action = SETTLEMENT_ACTION.WINNER;
    let settlementSignature: string;
    let transactionSignature: string | undefined;
    try {
      // Sign INSIDE the try so a bad winner address (or any signing error) returns
      // a failed result instead of rejecting. An unhandled rejection here would
      // crash the whole process — taking every other live match down with it.
      settlementSignature = await signSettlementAuthorization(action, room.matchId, winnerAddress);
      transactionSignature = await submitSettlementTransaction(action, room.matchId, winnerAddress);
      console.log(`[RoomBlockchain] On-chain settlement completed. Tx: ${transactionSignature}`);
      if (room.queueMatchPersisted) {
        await this.manager.queueMatches.markCompleted(room.id, winnerAddress);
      }
    } catch (err) {
      console.error(`[RoomBlockchain] Auto-settlement failed:`, err);
      if (room.queueMatchPersisted) {
        await this.manager.queueMatches.markSettlementFailed(room.id, winnerAddress, err).catch(() => {});
      }
      return { ok: false, error: err };
    }

    for (const client of room.clients.values()) {
      this.manager.network.safeSend(client.ws, {
        type: 'settlementAuthorization',
        payload: {
          winner: winnerAddress,
          matchId: room.matchId,
          settlementSignature,
          serverAddress,
        },
      } as WsMessage);
    }

    return { ok: true, signature: transactionSignature };
  }

  /**
   * Settles an anti-cheat invalidated match: refunds the honest player, the
   * cheater's stake goes to treasury.
   */
  public settleAntiCheat(room: Room, cheaterAddress: string): void {
    submitSettlementTransaction(SETTLEMENT_ACTION.CHEATER, room.matchId, cheaterAddress)
      .then((tx) => console.log(`[RoomBlockchain] Anti-Cheat settlement completed. Tx: ${tx}`))
      .catch((err) => console.error(`[RoomBlockchain] Anti-Cheat settlement failed:`, err));
  }

  /** Refunds both players. Only for draws and server errors (timeout-gated on-chain). */
  public refundMatch(room: Room, reason: 'draw' | 'server_error'): void {
    submitRefundTransaction(room.matchId)
      .then((tx) => console.log(`[RoomBlockchain] Refund completed for ${reason}. Tx: ${tx}`))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('TimeoutNotReached')) {
          console.warn(
            `[RoomBlockchain] Refund for ${reason} is timeout-gated on-chain and cannot be executed yet. ` +
            `Match UI/result has been finalized locally.`,
          );
          return;
        }
        console.error(`[RoomBlockchain] Refund failed for ${reason}:`, err);
      });
  }
}
