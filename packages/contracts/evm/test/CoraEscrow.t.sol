// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CoraEscrow} from "../src/CoraEscrow.sol";

/// Minimal 6-decimal ERC-20 to stand in for Base Sepolia USDC.
contract MockUSDC {
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract CoraEscrowTest is Test {
    CoraEscrow internal escrow;
    MockUSDC internal usdc;

    uint256 internal serverPk = 0xA11CE;
    address internal server;
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    address internal constant ETH = address(0);
    uint256 internal constant WAGER = 1 ether;
    uint256 internal constant USDC_WAGER = 5_000_000; // 5 USDC (6 decimals)
    bytes32 internal constant MID = keccak256("room-1");

    function setUp() public {
        server = vm.addr(serverPk);
        escrow = new CoraEscrow(treasury, server);
        usdc = new MockUSDC();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        usdc.mint(alice, 1_000_000_000);
        usdc.mint(bob, 1_000_000_000);
    }

    // ── helpers ──────────────────────────────────────────────
    function _sign(uint8 action, bytes32 matchId, address target) internal view returns (bytes memory) {
        bytes32 digest = escrow.settlementHash(action, matchId, target);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(serverPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _initAndFundEth(bytes32 matchId) internal {
        vm.prank(server);
        escrow.initializeMatch(matchId, ETH, WAGER, alice, bob);
        vm.prank(alice);
        escrow.deposit{value: WAGER}(matchId);
        vm.prank(bob);
        escrow.deposit{value: WAGER}(matchId);
    }

    // ── ETH deposit + activation ─────────────────────────────
    function test_DepositActivatesMatch() public {
        vm.prank(server);
        escrow.initializeMatch(MID, ETH, WAGER, alice, bob);

        vm.prank(alice);
        escrow.deposit{value: WAGER}(MID);
        (,,,, CoraEscrow.Status s1, bool a1, bool b1,,) = escrow.matches(MID);
        assertEq(uint8(s1), uint8(CoraEscrow.Status.WaitingDeposit));
        assertTrue(a1);
        assertFalse(b1);

        vm.prank(bob);
        escrow.deposit{value: WAGER}(MID);
        (,,,, CoraEscrow.Status s2,,,,) = escrow.matches(MID);
        assertEq(uint8(s2), uint8(CoraEscrow.Status.Active));
        assertEq(address(escrow).balance, 2 * WAGER);
    }

    function test_OnlyServerCanInitialize() public {
        vm.prank(alice);
        vm.expectRevert(CoraEscrow.NotServer.selector);
        escrow.initializeMatch(MID, ETH, WAGER, alice, bob);
    }

    function test_DepositWrongValueReverts() public {
        vm.prank(server);
        escrow.initializeMatch(MID, ETH, WAGER, alice, bob);
        vm.prank(alice);
        vm.expectRevert(CoraEscrow.WrongValue.selector);
        escrow.deposit{value: WAGER - 1}(MID);
    }

    function test_NonParticipantDepositReverts() public {
        vm.prank(server);
        escrow.initializeMatch(MID, ETH, WAGER, alice, bob);
        vm.deal(address(0xCAFE), 10 ether);
        vm.prank(address(0xCAFE));
        vm.expectRevert(CoraEscrow.UnauthorizedPlayer.selector);
        escrow.deposit{value: WAGER}(MID);
    }

    // ── settlement (winner) ──────────────────────────────────
    function test_SettleWinnerPayout() public {
        _initAndFundEth(MID);

        uint256 aliceBefore = alice.balance;
        uint256 treasuryBefore = treasury.balance;

        bytes memory sig = _sign(0, MID, alice);
        escrow.settleMatch(MID, 0, alice, sig);

        uint256 pool = 2 * WAGER;
        uint256 fee = (pool * 250) / 10_000; // 2.5%
        assertEq(alice.balance - aliceBefore, pool - fee);
        assertEq(treasury.balance - treasuryBefore, fee);
        assertEq(address(escrow).balance, 0);

        (,,,, CoraEscrow.Status s,,,,) = escrow.matches(MID);
        assertEq(uint8(s), uint8(CoraEscrow.Status.Settled));
    }

    // ── settlement (anti-cheat) ──────────────────────────────
    function test_SettleAntiCheatPenalty() public {
        _initAndFundEth(MID);

        uint256 bobBefore = bob.balance; // honest player
        uint256 treasuryBefore = treasury.balance;

        bytes memory sig = _sign(1, MID, alice);
        escrow.settleMatch(MID, 1, alice, sig);

        assertEq(bob.balance - bobBefore, WAGER);
        assertEq(treasury.balance - treasuryBefore, WAGER);
        assertEq(address(escrow).balance, 0);
    }

    function test_SettleBadSignatureReverts() public {
        _initAndFundEth(MID);
        bytes32 digest = escrow.settlementHash(0, MID, alice);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.expectRevert(CoraEscrow.InvalidSignature.selector);
        escrow.settleMatch(MID, 0, alice, sig);
    }

    function test_SettleWrongTargetReverts() public {
        _initAndFundEth(MID);
        bytes memory sig = _sign(0, MID, address(0xDEAD));
        vm.expectRevert(CoraEscrow.InvalidTarget.selector);
        escrow.settleMatch(MID, 0, address(0xDEAD), sig);
    }

    function test_CannotSettleTwice() public {
        _initAndFundEth(MID);
        bytes memory sig = _sign(0, MID, alice);
        escrow.settleMatch(MID, 0, alice, sig);
        vm.expectRevert(CoraEscrow.NotActive.selector);
        escrow.settleMatch(MID, 0, alice, sig);
    }

    // ── ERC-20 (USDC) flow ───────────────────────────────────
    function test_UsdcDepositAndSettle() public {
        vm.prank(server);
        escrow.initializeMatch(MID, address(usdc), USDC_WAGER, alice, bob);

        vm.startPrank(alice);
        usdc.approve(address(escrow), USDC_WAGER);
        escrow.deposit(MID);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(escrow), USDC_WAGER);
        escrow.deposit(MID);
        vm.stopPrank();

        (,,,, CoraEscrow.Status s,,,,) = escrow.matches(MID);
        assertEq(uint8(s), uint8(CoraEscrow.Status.Active));
        assertEq(usdc.balanceOf(address(escrow)), 2 * USDC_WAGER);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        bytes memory sig = _sign(0, MID, alice);
        escrow.settleMatch(MID, 0, alice, sig);

        uint256 pool = 2 * USDC_WAGER;
        uint256 fee = (pool * 250) / 10_000;
        assertEq(usdc.balanceOf(alice) - aliceBefore, pool - fee);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_UsdcDepositWithEthValueReverts() public {
        vm.prank(server);
        escrow.initializeMatch(MID, address(usdc), USDC_WAGER, alice, bob);
        vm.startPrank(alice);
        usdc.approve(address(escrow), USDC_WAGER);
        vm.expectRevert(CoraEscrow.WrongValue.selector);
        escrow.deposit{value: 1}(MID); // ERC-20 match must not carry ETH
        vm.stopPrank();
    }

    // ── refunds ──────────────────────────────────────────────
    function test_RefundWaitingDepositAfterTimeout() public {
        vm.prank(server);
        escrow.initializeMatch(MID, ETH, WAGER, alice, bob);
        vm.prank(alice);
        escrow.deposit{value: WAGER}(MID); // only alice deposited

        vm.expectRevert(CoraEscrow.TimeoutNotReached.selector);
        escrow.refund(MID);

        vm.warp(block.timestamp + 31);
        uint256 aliceBefore = alice.balance;
        escrow.refund(MID);
        assertEq(alice.balance - aliceBefore, WAGER);
        assertEq(address(escrow).balance, 0);
    }

    function test_RefundActiveAfterMatchTimeout() public {
        _initAndFundEth(MID);
        vm.expectRevert(CoraEscrow.TimeoutNotReached.selector);
        escrow.refund(MID);

        vm.warp(block.timestamp + 901);
        uint256 aBefore = alice.balance;
        uint256 bBefore = bob.balance;
        escrow.refund(MID);
        assertEq(alice.balance - aBefore, WAGER);
        assertEq(bob.balance - bBefore, WAGER);
    }

    // ── open challenges ──────────────────────────────────────
    function test_ChallengeLifecycleAccept() public {
        bytes32 cid = keccak256("challenge-1");
        vm.prank(alice);
        escrow.createOpenChallenge{value: WAGER}(cid, ETH, WAGER);

        vm.prank(bob);
        escrow.acceptChallenge{value: WAGER}(cid);

        (address pa, address pb, address tok, uint256 w, CoraEscrow.Status s,,,,) = escrow.matches(cid);
        assertEq(pa, alice);
        assertEq(pb, bob);
        assertEq(tok, ETH);
        assertEq(w, WAGER);
        assertEq(uint8(s), uint8(CoraEscrow.Status.Active));

        bytes memory sig = _sign(0, cid, bob);
        uint256 bobBefore = bob.balance;
        escrow.settleMatch(cid, 0, bob, sig);
        assertEq(bob.balance - bobBefore, 2 * WAGER - (2 * WAGER * 250) / 10_000);
    }

    function test_UsdcChallengeLifecycle() public {
        bytes32 cid = keccak256("challenge-usdc");
        vm.startPrank(alice);
        usdc.approve(address(escrow), USDC_WAGER);
        escrow.createOpenChallenge(cid, address(usdc), USDC_WAGER);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(escrow), USDC_WAGER);
        escrow.acceptChallenge(cid);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(escrow)), 2 * USDC_WAGER);
        (,, address tok,, CoraEscrow.Status s,,,,) = escrow.matches(cid);
        assertEq(tok, address(usdc));
        assertEq(uint8(s), uint8(CoraEscrow.Status.Active));
    }

    function test_ChallengeReclaimAfterExpiry() public {
        bytes32 cid = keccak256("challenge-2");
        vm.prank(alice);
        escrow.createOpenChallenge{value: WAGER}(cid, ETH, WAGER);

        vm.expectRevert(CoraEscrow.ChallengeNotExpired.selector);
        vm.prank(alice);
        escrow.reclaimChallenge(cid);

        vm.warp(block.timestamp + 901);
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        escrow.reclaimChallenge(cid);
        assertEq(alice.balance - aliceBefore, WAGER);
    }

    function test_CreatorCannotAcceptOwnChallenge() public {
        bytes32 cid = keccak256("challenge-3");
        vm.prank(alice);
        escrow.createOpenChallenge{value: WAGER}(cid, ETH, WAGER);
        vm.prank(alice);
        vm.expectRevert(CoraEscrow.CreatorCannotAccept.selector);
        escrow.acceptChallenge{value: WAGER}(cid);
    }
}
