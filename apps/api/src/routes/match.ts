import { Hono } from 'hono';
import type { WSEvents } from 'hono/ws';
import type { WsMessage } from '@shared/websocket';
import { RoomManager } from '../managers/RoomManager';
import { resolveToken } from '@shared/escrow';

// Default wager token when none is specified.
const ETH_TOKEN = 'ETH';

export function createMatchRouter(roomManager: RoomManager) {
  const router = new Hono();

  router.post('/', async (c) => {
    let address: string;
    let token: string | undefined;
    try {
      const body = await c.req.json();
      address = body.address;
      token = body.token;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!address) {
      return c.json({ error: 'Address is required' }, 400);
    }

    const existingRoom = roomManager.queue.findActiveRoomForAddress(address);
    const existingRoomId = existingRoom?.id;
    const roomId = await roomManager.queueMatch(address, token, c.req.raw.signal);

    if (roomId === '__aborted__') {
      return c.json({ error: 'Queue cancelled' }, 400);
    }

    const room = roomManager.getRoom(roomId);
    const role =
      room?.playerA === address ? 'playerA' :
      room?.playerB === address ? 'playerB' :
      undefined;

    return c.json({
      roomId,
      role,
      roomType: room?.roomType,
      alreadyInRoom: Boolean(existingRoomId && existingRoomId === roomId),
      status: room?.status,
    });
  });

  router.post('/bot', async (c) => {
    let address: string;
    let rawTokenMint: string | undefined;
    let wagerAmount: number | undefined;
    let characterId: string | undefined;

    try {
      const body = await c.req.json();
      address = body.address;
      rawTokenMint = body.tokenMint;
      wagerAmount = body.wagerAmount;
      characterId = body.characterId;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!address) {
      return c.json({ error: 'Address is required' }, 400);
    }

    const tokenMint = rawTokenMint ? (resolveToken(rawTokenMint)?.symbol ?? ETH_TOKEN) : null;

    const room = roomManager.createBotMatch(address, {
      tokenMint,
      wagerAmount: wagerAmount !== undefined ? BigInt(wagerAmount) : 0n,
      characterId,
    });
    const role =
      room.playerA === address ? 'playerA' :
      room.playerB === address ? 'playerB' :
      undefined;
    const opponentAddress = address === room.playerA ? room.playerB : room.playerA;

    return c.json({
      roomId: room.id,
      role,
      opponentAddress,
      roomType: room.roomType,
      status: room.status,
    });
  });

  router.get('/active/:address', (c) => {
    const address = c.req.param('address');
    const room = roomManager.queue.findActiveRoomForAddress(address);

    if (!room) {
      return c.json({ inRoom: false });
    }

    const role =
      room.playerA === address ? 'playerA' :
      room.playerB === address ? 'playerB' :
      undefined;

    return c.json({
      inRoom: true,
      roomId: room.id,
      role,
      roomType: room.roomType,
      status: room.status,
      playerA: room.playerA,
      playerB: room.playerB,
    });
  });

  router.get('/presence/:address', (c) => {
    const address = c.req.param('address');
    const room = roomManager.queue.findActiveRoomForAddress(address);

    if (room) {
      const role =
        room.playerA === address ? 'playerA' :
        room.playerB === address ? 'playerB' :
        undefined;

      return c.json({
        inRoom: true,
        queued: false,
        roomId: room.id,
        role,
        roomType: room.roomType,
        status: room.status,
      });
    }

    return c.json({
      inRoom: false,
      queued: roomManager.queue.isQueued(address),
    });
  });

  // Private room creation for direct challenge invites (Step 1).
  // Returns the on-chain params the frontend needs to call
  // `createOpenChallenge(matchId)` with value=wagerWei. DB row is NOT written yet.
  // wagerAmount is in wei; native ETH only.
  router.post('/private', async (c) => {
    let address: string;
    let token: string | undefined;

    try {
      const body = await c.req.json();
      address = body.address;
      token = body.token;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!address) {
      return c.json({ error: 'address is required' }, 400);
    }

    const { roomId, matchId, escrowAddress, chainId, token: tokenSymbol, wagerWei } =
      roomManager.createPrivateRoom(address, token ?? ETH_TOKEN);

    const baseUrl = process.env.FE_BASE_URL?.split(',')[0] || 'http://localhost:3000';
    const challengeUrl = `${baseUrl}/challenge/${roomId}`;

    return c.json({
      roomId,
      matchId,
      escrowAddress,
      chainId,
      token: tokenSymbol,
      wagerWei,
      challengeUrl,
      role: 'playerA',
      roomType: 'private',
    });
  });

  // Private room creation confirmation (Step 2).
  // Client sends the mined `createOpenChallenge` tx hash; we verify the receipt
  // and write the DB row only after successful on-chain confirmation.
  router.post('/private/confirm', async (c) => {
    let roomId: string;
    let address: string;
    let txHash: string;
    let token: string | undefined;
    let wagerAmount: string | number;

    try {
      const body = await c.req.json();
      roomId = body.roomId;
      address = body.address;
      txHash = body.txHash ?? body.signature;
      token = body.token;
      wagerAmount = body.wagerAmount;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!roomId || !address || !txHash || wagerAmount === undefined || wagerAmount === null) {
      return c.json({ error: 'roomId, address, txHash, and wagerAmount (wei) are required' }, 400);
    }

    try {
      const match = await roomManager.confirmPrivateRoom(roomId, address, txHash, token ?? ETH_TOKEN, BigInt(wagerAmount));
      return c.json({ status: match.status, roomId: match.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timeout') || message.includes('Timeout') || message.includes('expired')) {
        return c.json({ error: 'Transaction confirmation timed out. Please retry.' }, 408);
      }
      console.error(`[match/private/confirm] Confirmation failed for room ${roomId}:`, err);
      return c.json({ error: `Transaction confirmation failed: ${message}` }, 400);
    }
  });

  // Challenge accept (EVM): challenger sends the mined `acceptChallenge` tx hash.
  router.post('/private/accept', async (c) => {
    let roomId: string;
    let address: string;
    let txHash: string;
    try {
      const body = await c.req.json();
      roomId = body.roomId;
      address = body.address;
      txHash = body.txHash ?? body.signature;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    if (!roomId || !address || !txHash) {
      return c.json({ error: 'roomId, address, and txHash are required' }, 400);
    }
    try {
      const result = await roomManager.acceptPrivateChallenge(roomId, address, txHash);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[match/private/accept] Accept failed for room ${roomId}:`, err);
      return c.json({ error: `Challenge accept failed: ${message}` }, 400);
    }
  });

  router.get('/private/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    const match = await roomManager.refreshBlinkMatchExpiry(roomId);

    if (!match) {
      return c.json({ error: 'Private challenge not found' }, 404);
    }

    return c.json({
      roomId: match.id,
      roomType: 'private',
      status: match.status,
      creatorWallet: match.creatorWallet,
      opponentWallet: match.opponentWallet,
      tokenMint: match.tokenMint,
      wagerAmount: match.wagerAmount,
      expiresAt: match.expiresAt,
      joinDeadline: match.joinDeadline,
    });
  });

  return router;
}

export function createApiMatchRouter(roomManager: RoomManager) {
  const router = new Hono();

  router.get('/:roomId/proof', (c) => {
    const roomId = c.req.param('roomId');
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return c.json({ error: 'Match not found' }, 404);
    }

    // On Base Sepolia the on-chain footprint is the escrow match + settlement tx.
    // (MagicBlock ER proofs no longer exist after the Base migration.)
    const escrow = process.env.ESCROW_CONTRACT_ADDRESS ?? '';
    return c.json({
      matchId: room.matchId,
      escrowAddress: escrow,
      explorerUrl: escrow ? `https://sepolia.basescan.org/address/${escrow}` : null,
      chainId: 84532,
    });
  });

  return router;
}

export function createMatchSocketRoute(roomManager: RoomManager) {
  return (roomId: string | undefined, address: string | undefined, characterId: string): WSEvents => {
    if (!roomId || !address) {
      return {
        onOpen(_event, ws) {
          ws.close(1008, 'RoomId and Address are required');
        },
      };
    }

    return {
      onOpen(_event, ws) {
        roomManager.joinRoom(roomId, address, ws, characterId);
      },
      onMessage(event) {
        try {
          const parsed = JSON.parse(event.data.toString()) as WsMessage;
          roomManager.handleMessage(roomId, address, parsed);
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      },
      onClose(_event, ws) {
        roomManager.leaveRoom(roomId, address, ws);
      },
    };
  };
}
