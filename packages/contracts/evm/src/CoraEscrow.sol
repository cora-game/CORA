// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title CoraEscrow
/// @notice Wager escrow for CORA matches on Base Sepolia. Supports native ETH
///         AND ERC-20 tokens (e.g. USDC) per match. Port of the Solana
///         `cora-escrow` Anchor program.
///
///         Each match/challenge records a `token`: address(0) means native ETH,
///         otherwise an ERC-20. Deposits, payouts and refunds branch on it.
///
///         Money flow:
///           - Two players each deposit `wager` (ETH or ERC-20) into a match.
///           - Normal result: server signs an EIP-712 `Settlement(action=0,
///             target=winner)` and submits `settleMatch`: winner gets 97.5% of
///             the 2x pool, treasury gets 2.5%.
///           - Anti-cheat (action=1, target=cheater): honest player refunded,
///             cheater's stake goes to treasury.
///           - Timeout refunds + the open-challenge lifecycle mirror Solana.
///
///         The server's ed25519 keypair on Solana is replaced by a secp256k1
///         EOA (`serverSigner`); the on-chain ed25519-sysvar check is replaced
///         by EIP-712 + ecrecover, binding each signature to this chain and
///         contract (replay-safe). The signed message is (action, matchId,
///         target) only — the token + wager are bound on-chain via the match
///         record, so they do not need to be in the signature.
contract CoraEscrow {
    // ─────────────────────────── Config ───────────────────────────
    address public admin;
    address public treasury;
    address public serverSigner;

    // ─────────────────────────── Constants ────────────────────────
    /// @notice Protocol fee in basis points (2.5%).
    uint256 public constant FEE_BPS = 250;
    uint256 public constant BPS_DIVISOR = 10_000;
    /// @notice Seconds before an undeposited match can be refunded.
    uint64 public constant DEPOSIT_TIMEOUT = 30;
    /// @notice Seconds before a stuck active match can be refunded.
    uint64 public constant MATCH_TIMEOUT = 900;
    /// @notice Seconds an open challenge stays acceptable.
    uint64 public constant CHALLENGE_EXPIRY = 900;

    enum Status {
        None, // 0 — never created
        WaitingDeposit, // 1
        Active, // 2
        Settled, // 3
        Refunded // 4
    }

    struct Match {
        address playerA;
        address playerB;
        address token; // address(0) = native ETH, else ERC-20
        uint256 wager;
        Status status;
        bool aDeposited;
        bool bDeposited;
        uint64 createdAt;
        uint64 activeAt;
    }

    struct Challenge {
        address creator;
        address token; // address(0) = native ETH, else ERC-20
        uint256 wager;
        uint64 createdAt;
        uint64 expiresAt;
        bool exists;
    }

    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => Challenge) public challenges;

    // ─────────────────────────── EIP-712 ──────────────────────────
    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 private constant SETTLEMENT_TYPEHASH =
        keccak256("Settlement(uint8 action,bytes32 matchId,address target)");

    // ─────────────────────────── Events ───────────────────────────
    event MatchInitialized(bytes32 indexed matchId, address playerA, address playerB, address token, uint256 wager);
    event WagerDeposited(bytes32 indexed matchId, address depositor, uint256 amount, bool matchActive);
    event MatchSettled(bytes32 indexed matchId, uint8 action, address target);
    event MatchRefunded(bytes32 indexed matchId);
    event ChallengeCreated(bytes32 indexed matchId, address creator, address token, uint256 wager, uint64 expiresAt);
    event ChallengeAccepted(bytes32 indexed matchId, address creator, address challenger, address token, uint256 wager);
    event ChallengeReclaimed(bytes32 indexed matchId, address creator, uint256 amount);
    event ConfigUpdated(address treasury, address serverSigner);

    // ─────────────────────────── Errors ───────────────────────────
    error NotAdmin();
    error NotServer();
    error InvalidWagerAmount();
    error SamePlayer();
    error MatchExists();
    error NotWaitingDeposit();
    error UnauthorizedPlayer();
    error AlreadyDeposited();
    error WrongValue();
    error NotActive();
    error InvalidAction();
    error InvalidTarget();
    error InvalidSignature();
    error AlreadyFinalized();
    error InvalidRefundState();
    error TimeoutNotReached();
    error ChallengeExists();
    error NoChallenge();
    error ChallengeExpired();
    error ChallengeNotExpired();
    error CreatorCannotAccept();
    error TransferFailed();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address treasury_, address serverSigner_) {
        require(treasury_ != address(0) && serverSigner_ != address(0), "zero addr");
        admin = msg.sender;
        treasury = treasury_;
        serverSigner = serverSigner_;

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("CoraEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ─────────────────────────── Admin ────────────────────────────
    function updateConfig(address treasury_, address serverSigner_) external onlyAdmin {
        require(treasury_ != address(0) && serverSigner_ != address(0), "zero addr");
        treasury = treasury_;
        serverSigner = serverSigner_;
        emit ConfigUpdated(treasury_, serverSigner_);
    }

    // ─────────────────────────── Match lifecycle ──────────────────

    /// @notice Server-only: create a match so the two named players can deposit.
    ///         `token` is address(0) for native ETH or an ERC-20 address (USDC).
    function initializeMatch(bytes32 matchId, address token, uint256 wager, address playerA, address playerB)
        external
    {
        if (msg.sender != serverSigner && msg.sender != admin) revert NotServer();
        if (wager == 0) revert InvalidWagerAmount();
        if (playerA == playerB || playerA == address(0) || playerB == address(0)) revert SamePlayer();
        if (matches[matchId].status != Status.None) revert MatchExists();

        matches[matchId] = Match({
            playerA: playerA,
            playerB: playerB,
            token: token,
            wager: wager,
            status: Status.WaitingDeposit,
            aDeposited: false,
            bDeposited: false,
            createdAt: uint64(block.timestamp),
            activeAt: 0
        });

        emit MatchInitialized(matchId, playerA, playerB, token, wager);
    }

    /// @notice A participant deposits exactly `wager`. For ETH, send it as
    ///         msg.value; for an ERC-20, approve this contract first (msg.value
    ///         must be 0 and the tokens are pulled via transferFrom).
    function deposit(bytes32 matchId) external payable {
        Match storage m = matches[matchId];
        if (m.status != Status.WaitingDeposit) revert NotWaitingDeposit();

        if (msg.sender == m.playerA) {
            if (m.aDeposited) revert AlreadyDeposited();
            m.aDeposited = true;
        } else if (msg.sender == m.playerB) {
            if (m.bDeposited) revert AlreadyDeposited();
            m.bDeposited = true;
        } else {
            revert UnauthorizedPlayer();
        }

        _pull(m.token, msg.sender, m.wager);

        bool active = m.aDeposited && m.bDeposited;
        if (active) {
            m.status = Status.Active;
            m.activeAt = uint64(block.timestamp);
        }

        emit WagerDeposited(matchId, msg.sender, m.wager, active);
    }

    /// @notice Settle an active match. `signature` is an EIP-712 `Settlement`
    ///         signed by `serverSigner`.
    ///         action 0: `target` is the winner → 97.5% of pool, 2.5% fee.
    ///         action 1: `target` is the cheater → honest player refunded, fee = cheater stake.
    function settleMatch(bytes32 matchId, uint8 action, address target, bytes calldata signature) external {
        Match storage m = matches[matchId];
        if (m.status != Status.Active) revert NotActive();
        if (action > 1) revert InvalidAction();
        if (target != m.playerA && target != m.playerB) revert InvalidTarget();

        _verifySettlement(action, matchId, target, signature);

        uint256 wager = m.wager;
        address token = m.token;
        address playerA = m.playerA;
        address playerB = m.playerB;

        // Effects before interactions.
        m.status = Status.Settled;

        if (action == 0) {
            uint256 pool = wager * 2;
            uint256 fee = (pool * FEE_BPS) / BPS_DIVISOR;
            _payout(token, target, pool - fee);
            _payout(token, treasury, fee);
        } else {
            address honest = target == playerA ? playerB : playerA;
            _payout(token, honest, wager);
            _payout(token, treasury, wager);
        }

        emit MatchSettled(matchId, action, target);
    }

    /// @notice Refund a stuck match after its timeout. Each deposited player
    ///         gets their wager back. WaitingDeposit uses DEPOSIT_TIMEOUT (from
    ///         createdAt); Active uses MATCH_TIMEOUT (from activeAt).
    function refund(bytes32 matchId) external {
        Match storage m = matches[matchId];
        if (m.status != Status.WaitingDeposit && m.status != Status.Active) revert AlreadyFinalized();

        uint64 startedAt;
        uint64 required;
        if (m.status == Status.Active) {
            if (!m.aDeposited || !m.bDeposited) revert InvalidRefundState();
            startedAt = m.activeAt != 0 ? m.activeAt : m.createdAt;
            required = MATCH_TIMEOUT;
        } else {
            startedAt = m.createdAt;
            required = DEPOSIT_TIMEOUT;
        }
        if (block.timestamp < startedAt + required) revert TimeoutNotReached();

        uint256 wager = m.wager;
        address token = m.token;
        bool a = m.aDeposited;
        bool b = m.bDeposited;
        address playerA = m.playerA;
        address playerB = m.playerB;

        m.status = Status.Refunded;

        if (a) _payout(token, playerA, wager);
        if (b) _payout(token, playerB, wager);

        emit MatchRefunded(matchId);
    }

    // ─────────────────────────── Open challenges ──────────────────

    /// @notice Create an open challenge: the creator escrows `wager` (ETH via
    ///         msg.value, or an ERC-20 via approve+transferFrom) that anyone can
    ///         accept (matching the deposit) before it expires.
    function createOpenChallenge(bytes32 matchId, address token, uint256 wager) external payable {
        if (wager == 0) revert InvalidWagerAmount();
        if (challenges[matchId].exists) revert ChallengeExists();
        if (matches[matchId].status != Status.None) revert MatchExists();

        challenges[matchId] = Challenge({
            creator: msg.sender,
            token: token,
            wager: wager,
            createdAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + CHALLENGE_EXPIRY,
            exists: true
        });

        _pull(token, msg.sender, wager);

        emit ChallengeCreated(matchId, msg.sender, token, wager, uint64(block.timestamp) + CHALLENGE_EXPIRY);
    }

    /// @notice Accept an open challenge by matching the creator's wager. Creates
    ///         an immediately-Active match (creator = playerA, challenger = playerB).
    function acceptChallenge(bytes32 matchId) external payable {
        Challenge storage c = challenges[matchId];
        if (!c.exists) revert NoChallenge();
        if (block.timestamp >= c.expiresAt) revert ChallengeExpired();
        if (msg.sender == c.creator) revert CreatorCannotAccept();
        if (matches[matchId].status != Status.None) revert MatchExists();

        address creator = c.creator;
        address token = c.token;
        uint256 wager = c.wager;
        delete challenges[matchId];

        // Pull the challenger's matching stake (creator's is already escrowed).
        _pull(token, msg.sender, wager);

        matches[matchId] = Match({
            playerA: creator,
            playerB: msg.sender,
            token: token,
            wager: wager,
            status: Status.Active,
            aDeposited: true,
            bDeposited: true,
            createdAt: uint64(block.timestamp),
            activeAt: uint64(block.timestamp)
        });

        emit ChallengeAccepted(matchId, creator, msg.sender, token, wager);
    }

    /// @notice Creator reclaims their escrowed wager after the challenge expires.
    function reclaimChallenge(bytes32 matchId) external {
        Challenge storage c = challenges[matchId];
        if (!c.exists) revert NoChallenge();
        if (msg.sender != c.creator) revert UnauthorizedPlayer();
        if (block.timestamp < c.expiresAt) revert ChallengeNotExpired();

        uint256 wager = c.wager;
        address token = c.token;
        address creator = c.creator;
        delete challenges[matchId];

        _payout(token, creator, wager);
        emit ChallengeReclaimed(matchId, creator, wager);
    }

    // ─────────────────────────── Views ────────────────────────────
    function domainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function settlementHash(uint8 action, bytes32 matchId, address target) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(SETTLEMENT_TYPEHASH, action, matchId, target));
        return keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
    }

    // ─────────────────────────── Internal ─────────────────────────
    function _verifySettlement(uint8 action, bytes32 matchId, address target, bytes calldata signature) internal view {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 digest = settlementHash(action, matchId, target);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        // Reject malleable (upper-half) s values.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != serverSigner) revert InvalidSignature();
    }

    /// @dev Pulls `amount` of `token` from `from` into this contract.
    ///      For native ETH (token == address(0)) it instead validates msg.value.
    function _pull(address token, address from, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value != amount) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            _safeTransferFrom(token, from, address(this), amount);
        }
    }

    /// @dev Pays out `amount` of `token` to `to` (ETH or ERC-20).
    function _payout(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            _safeTransfer(token, to, amount);
        }
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
