import { Hono } from 'hono';
import { PublicKey } from '@solana/web3.js';
import { deriveMatchId } from '@shared/escrow';
import { RoomManager } from '../managers/RoomManager';
import { BlinkTransactionBuilder } from '../services/BlinkTransactionBuilder';
import type { BlinkMatch } from '../services/blinkMatches';
import { resolveTokenMint } from '../config/tokens';

export function createActionsRouter(roomManager: RoomManager) {
  const router = new Hono();

  router.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids',
    );
    c.header('Access-Control-Expose-Headers', 'X-Action-Version, X-Blockchain-Ids');
    c.header('X-Action-Version', '2.1.3');
    c.header('X-Blockchain-Ids', 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }

    await next();
  });

  router.get('/challenge', async (c) => {
    const roomId = c.req.query('roomId');
    const iconUrl = 'https://arweave.net/qN7Xy_CgGf2Y-DItf-Bf0iV9Wl80S-c4m2rV6Q5S3j0';
    const acceptHeader = c.req.header('Accept') ?? '';
    const feBaseUrl = process.env.FE_BASE_URL || 'http://localhost:3000';

    // Browser request: redirect to FE challenge page instead of returning JSON.
    // Blink-compatible wallets send Accept: application/json — let those through.
    if (roomId && isBrowserRequest(acceptHeader)) {
      return c.redirect(`${feBaseUrl}/challenge/${roomId}`, 302);
    }

    if (roomId) {
      const match = await roomManager.refreshBlinkMatchExpiry(roomId);

      if (!match) {
        return c.json({ error: { message: 'Challenge canceled - this room no longer exists.' } }, 400);
      }
      if (match.status === 'EXPIRED') {
        return c.json({ error: { message: 'Expired - this challenge was not accepted within 15 minutes.' } }, 410);
      }
      if (match.status === 'FORFEITED') {
        return c.json({ error: { message: 'Challenge forfeited - the creator missed the response window.' } }, 410);
      }
      if (match.status !== 'PENDING' || match.opponentWallet !== null) {
        return c.json({ error: { message: 'Challenge already accepted - this match is full.' } }, 400);
      }

      return c.json({
        type: 'action' as const,
        icon: iconUrl,
        title: 'CORA - Accept the Challenge',
        description:
          'Your opponent is waiting. Deposit your wager and join the battle. ' +
          '97.5% to the winner - powered by Solana.',
        label: 'Accept & Deposit',
        links: {
          actions: [
            {
              type: 'transaction' as const,
              label: 'Accept Challenge',
              href: `/api/actions/challenge?roomId=${roomId}`,
            },
          ],
        },
      });
    }

    return c.json({
      type: 'action' as const,
      icon: iconUrl,
      title: 'CORA - Challenge Me',
      description:
        'Wager your tokens in a high-stakes aptitude battle. ' +
        'Match instantly, prove your logic skills, and take the pot. ' +
        '97.5% to the winner - powered by Solana.',
      label: 'Deposit & Play',
      links: {
        actions: [
          {
            type: 'transaction' as const,
            label: 'Stake 5 USDC',
            href: '/api/actions/challenge?amount=5',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 10 USDC',
            href: '/api/actions/challenge?amount=10',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 25 USDC',
            href: '/api/actions/challenge?amount=25',
          },
          {
            type: 'transaction' as const,
            label: 'Custom Stake',
            href: '/api/actions/challenge?amount={amount}',
            parameters: [
              {
                type: 'number' as const,
                name: 'amount',
                label: 'Enter stake amount (USDC)',
                required: true,
                min: 1,
                max: 1000,
                patternDescription: 'Enter a number between 1 and 1000',
              },
            ],
          },
        ],
      },
    });
  });

  router.post('/challenge', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const account: string | undefined = body.account;
      const roomId = c.req.query('roomId');

      if (!account) {
        return c.json(
          { message: 'Missing `account` in POST body (base58 public key)' } satisfies ActionError,
          400,
        );
      }

      if (!roomId) {
        return c.json(
          { message: 'Missing `roomId` query parameter. Use POST /match/private to create a room first.' } satisfies ActionError,
          400,
        );
      }

      try {
        new PublicKey(account);
      } catch {
        return c.json({ message: 'Invalid `account` - not a valid base58 public key.' } satisfies ActionError, 400);
      }

      const publicRoom = roomManager.getRoom(roomId);
      if (publicRoom?.roomType === 'public') {
        if (publicRoom.tokenMint === null && body.tokenMint) {
          const resolved = resolveTokenMint(body.tokenMint);
          if (!resolved) {
            return c.json({ message: `Unknown token "${body.tokenMint}" - provide a symbol (SOL, BONK, USDC) or a valid mint address.` } satisfies ActionError, 400);
          }
          publicRoom.tokenMint = resolved;
        }
        if (publicRoom.wagerAmount === null && body.wagerAmount !== undefined) {
          publicRoom.wagerAmount = BigInt(body.wagerAmount);
        }
        if (!publicRoom.tokenMint || publicRoom.wagerAmount === null) {
          return c.json({ message: 'Internal error - room is missing token configuration.' } satisfies ActionError, 500);
        }

        try {
          new PublicKey(publicRoom.tokenMint);
        } catch {
          return c.json({ message: 'Internal error - room has an invalid tokenMint.' } satisfies ActionError, 500);
        }

        const isPlayerA = publicRoom.playerA === account;
        const isPlayerB = publicRoom.playerB === account;
        if (!isPlayerA && !isPlayerB) {
          return c.json({ message: 'Account is not a participant in this room.' } satisfies ActionError, 403);
        }

        const base64 = await BlinkTransactionBuilder.buildDepositTransaction(account, publicRoom, isPlayerA);
        return c.json({
          transaction: base64,
          message: 'Sign to deposit your wager and join the CORA battle!',
        });
      }

      const match = await roomManager.refreshBlinkMatchExpiry(roomId);
      if (!match) {
        return c.json({ message: 'Challenge canceled - this room no longer exists.' } satisfies ActionError, 404);
      }

      try {
        new PublicKey(match.tokenMint);
      } catch {
        return c.json({ message: 'Internal error - room has an invalid tokenMint.' } satisfies ActionError, 500);
      }

      if (match.status === 'EXPIRED') {
        return c.json({ message: 'Expired - this challenge was not accepted within 15 minutes.' } satisfies ActionError, 410);
      }
      if (match.status === 'FORFEITED') {
        return c.json({ message: 'Challenge forfeited - the creator missed the response window.' } satisfies ActionError, 410);
      }

      let acceptedMatch: BlinkMatch = match;
      let message = '';

      if (match.status === 'PENDING') {
        // True flow: challenger accepts the open challenge
        const acceptResult = await roomManager.blinkMatches.acceptPending(roomId, account);
        if (!acceptResult.ok) {
          return c.json(
            { message: actionErrorForAcceptReason(acceptResult.reason) } satisfies ActionError,
            statusForAcceptReason(acceptResult.reason),
          );
        }

        acceptedMatch = acceptResult.match;
        message = 'Challenge accepted! Sign to lock your wager and start the match.';
        await roomManager.hydrateBlinkRoom(acceptedMatch);

        // Build accept_challenge transaction using creator wallet from DB row
        const matchIdBytes = deriveMatchId(roomId);
        const base64 = await BlinkTransactionBuilder.buildAcceptChallengeTransaction(
          account,
          matchIdBytes,
          acceptedMatch.tokenMint,
          acceptedMatch.creatorWallet,
          BigInt(acceptedMatch.wagerAmount)
        );

        return c.json({
          transaction: base64,
          message,
        });
      }

      // CHALLENGED or any other non-PENDING status:
      // Creator no longer has a second deposit transaction in the true flow.
      // After accept_challenge, both wagers are locked on-chain.
      // Creator only needs to join the WebSocket room before join_deadline.
      return c.json(
        { message: 'Challenge already accepted. Join the match via WebSocket.' } satisfies ActionError,
        409,
      );
    } catch (err) {
      console.error('[actions/challenge POST] Failed to build transaction', err);
      return c.json(
        { message: 'Internal error - failed to build transaction' } satisfies ActionError,
        500,
      );
    }
  });

  return router;
}

interface ActionError {
  message: string;
}

function actionErrorForAcceptReason(reason: string): string {
  if (reason === 'not_found') return 'Challenge canceled - this room no longer exists.';
  if (reason === 'expired') return 'Expired - this challenge was not accepted within 15 minutes.';
  if (reason === 'creator_cannot_accept') return 'Challenge creator cannot accept their own Blink.';
  if (reason === 'already_accepted') return 'Challenge already accepted - this match is full.';
  return 'Challenge is no longer accepting deposits.';
}

function statusForAcceptReason(reason: string): 400 | 404 | 409 | 410 {
  if (reason === 'not_found') return 404;
  if (reason === 'expired') return 410;
  if (reason === 'already_accepted') return 409;
  return 400;
}

/**
 * Returns true if the request is from a normal browser rather than a
 * Blink-compatible wallet or API client.
 * Blink clients send Accept: application/json.
 * Browsers send Accept: text/html,...
 */
function isBrowserRequest(acceptHeader: string): boolean {
  return acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');
}
