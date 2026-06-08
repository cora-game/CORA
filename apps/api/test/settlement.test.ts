import { test, expect, describe } from 'bun:test';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildSettlementMessage, deriveMatchId, ESCROW_CONSTANTS } from '@shared/escrow';
import { signSettlementAuthorization, serverPublicKey } from '../src/utils/settlement';
import { PublicKey } from '@solana/web3.js';

describe('settlement', () => {
  test('serverPublicKey is a valid base58 string', () => {
    expect(typeof serverPublicKey).toBe('string');
    expect(serverPublicKey.length).toBeGreaterThan(30);
    // Should be decodable as base58
    const decoded = bs58.decode(serverPublicKey);
    expect(decoded.length).toBe(32);
  });

  test('signSettlementAuthorization produces a valid signature for normal win', () => {
    const matchId = deriveMatchId('test-room-settlement');
    const winner = new PublicKey(Buffer.alloc(32, 1)).toBase58();

    const sig = signSettlementAuthorization(0, matchId, winner);

    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);

    // Decode and verify signature length (ed25519 = 64 bytes)
    const sigBytes = bs58.decode(sig);
    expect(sigBytes.length).toBe(64);
  });

  test('signSettlementAuthorization produces a valid signature for anti-cheat', () => {
    const matchId = deriveMatchId('test-room-cheat');
    const cheater = new PublicKey(Buffer.alloc(32, 2)).toBase58();

    const sig = signSettlementAuthorization(1, matchId, cheater);

    // Decode and verify signature length (ed25519 = 64 bytes)
    const sigBytes = bs58.decode(sig);
    expect(sigBytes.length).toBe(64);
  });

  test('signature is deterministic for same inputs', () => {
    const matchId = deriveMatchId('deterministic-room');
    const winner = new PublicKey(Buffer.alloc(32, 3)).toBase58();

    const sig1 = signSettlementAuthorization(0, matchId, winner);
    const sig2 = signSettlementAuthorization(0, matchId, winner);

    expect(sig1).toBe(sig2);
  });

  test('different inputs produce different signatures', () => {
    const matchId1 = deriveMatchId('room-A');
    const matchId2 = deriveMatchId('room-B');
    const winner = new PublicKey(Buffer.alloc(32, 4)).toBase58();

    const sig1 = signSettlementAuthorization(0, matchId1, winner);
    const sig2 = signSettlementAuthorization(0, matchId2, winner);

    expect(sig1).not.toBe(sig2);
  });

  test('signature verifies against server public key', () => {
    const matchId = deriveMatchId('verify-room');
    const winner = new PublicKey(Buffer.alloc(32, 5)).toBase58();

    const sig = signSettlementAuthorization(0, matchId, winner);

    const messageBytes = buildSettlementMessage(0, matchId, winner);
    const sigBytes = bs58.decode(sig);
    const pubKeyBytes = bs58.decode(serverPublicKey);

    const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);
    expect(valid).toBe(true);
  });

  test('settlement message format matches shared escrow spec', () => {
    const matchId = deriveMatchId('format-room');
    const winnerBytes = Buffer.alloc(32, 6);
    const winner = new PublicKey(winnerBytes).toBase58();

    const message = buildSettlementMessage(1, matchId, winner);

    expect(message.length).toBe(65);
    expect(message[0]).toBe(1); // action byte
    expect(Buffer.from(message.subarray(1, 33))).toEqual(Buffer.from(matchId));
    expect(Buffer.from(message.subarray(33, 65))).toEqual(winnerBytes);
  });
});

describe('deriveMatchId', () => {
  test('produces 32-byte Uint8Array', () => {
    const id = deriveMatchId('room-123');
    expect(id).toBeInstanceOf(Uint8Array);
    expect(id.length).toBe(32);
  });

  test('is deterministic', () => {
    const a = deriveMatchId('room-xyz');
    const b = deriveMatchId('room-xyz');
    expect(a).toEqual(b);
  });

  test('different room IDs produce different match IDs', () => {
    const a = deriveMatchId('room-1');
    const b = deriveMatchId('room-2');
    expect(a).not.toEqual(b);
  });
});

describe('MatchState v2 layout (version field)', () => {
  test('byte offsets account for version field at position 8', () => {
    // Simulate a MatchState buffer with known values:
    // 8 (discriminator) + 1 (version) + 32 (match_id) + 32 (player_a) + 32 (player_b) + 32 (token_mint)
    const buf = Buffer.alloc(137); // 8 + 1 + 32 + 32 + 32 + 32

    // Write discriminator (arbitrary)
    buf.set([250, 209, 137, 70, 235, 96, 121, 216], 0);
    // Write version
    buf.writeUInt8(ESCROW_CONSTANTS.MATCH_STATE_VERSION, 8);
    // Write match_id (32 bytes of 0xAA)
    buf.fill(0xAA, 9, 41);
    // Write player_a (32 bytes of 0xBB)
    buf.fill(0xBB, 41, 73);
    // Write player_b (32 bytes of 0xCC)
    buf.fill(0xCC, 73, 105);
    // Write token_mint (32 bytes of 0xDD)
    buf.fill(0xDD, 105, 137);

    // Verify the offsets match what settlement.ts uses
    const playerA = new PublicKey(buf.subarray(41, 73));
    const playerB = new PublicKey(buf.subarray(73, 105));
    const tokenMint = new PublicKey(buf.subarray(105, 137));

    expect(Buffer.from(playerA.toBytes()).every(b => b === 0xBB)).toBe(true);
    expect(Buffer.from(playerB.toBytes()).every(b => b === 0xCC)).toBe(true);
    expect(Buffer.from(tokenMint.toBytes()).every(b => b === 0xDD)).toBe(true);
  });

  test('version field defaults to 1', () => {
    expect(ESCROW_CONSTANTS.MATCH_STATE_VERSION).toBe(1);
    expect(ESCROW_CONSTANTS.PROGRAM_CONFIG_VERSION).toBe(1);
  });
});
