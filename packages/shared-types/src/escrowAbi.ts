/**
 * ABI for the CoraEscrow contract (packages/contracts/evm/src/CoraEscrow.sol).
 *
 * Hand-maintained subset used by the backend (settlement/event listener) and
 * the frontend (deposit/challenge calls). Keep in sync with the Solidity source;
 * the canonical ABI is emitted by `forge build` into
 * packages/contracts/evm/out/CoraEscrow.sol/CoraEscrow.json.
 */
export const CORA_ESCROW_ABI = [
  // ── reads ──
  {
    type: 'function',
    name: 'matches',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'playerA', type: 'address' },
      { name: 'playerB', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'wager', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'aDeposited', type: 'bool' },
      { name: 'bDeposited', type: 'bool' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'activeAt', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'challenges',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'wager', type: 'uint256' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'serverSigner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'treasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'settlementHash',
    stateMutability: 'view',
    inputs: [
      { name: 'action', type: 'uint8' },
      { name: 'matchId', type: 'bytes32' },
      { name: 'target', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  // ── writes ──
  {
    type: 'function',
    name: 'initializeMatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'wager', type: 'uint256' },
      { name: 'playerA', type: 'address' },
      { name: 'playerB', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'settleMatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'action', type: 'uint8' },
      { name: 'target', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'createOpenChallenge',
    stateMutability: 'payable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'wager', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptChallenge',
    stateMutability: 'payable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'reclaimChallenge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  // ── events ──
  {
    type: 'event',
    name: 'MatchInitialized',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'playerA', type: 'address', indexed: false },
      { name: 'playerB', type: 'address', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'wager', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WagerDeposited',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'depositor', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'matchActive', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MatchSettled',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'target', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MatchRefunded',
    inputs: [{ name: 'matchId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'ChallengeCreated',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'wager', type: 'uint256', indexed: false },
      { name: 'expiresAt', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeAccepted',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: false },
      { name: 'challenger', type: 'address', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'wager', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeReclaimed',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * Minimal ERC-20 ABI for the wager token (USDC): allowance/approve so a player
 * can authorize the escrow to pull their stake, and balanceOf for playability.
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;
