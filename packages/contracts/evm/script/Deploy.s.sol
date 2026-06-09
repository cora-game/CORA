// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CoraEscrow} from "../src/CoraEscrow.sol";

/// @notice Deploys CoraEscrow to Base Sepolia.
///
/// Required env vars:
///   PRIVATE_KEY            - deployer key (becomes `admin`)
///   TREASURY_ADDRESS       - fee receiver
///   SERVER_SIGNER_ADDRESS  - EOA that signs settlement (matches API SERVER_PRIVATE_KEY)
///
/// Run:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url base_sepolia --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address serverSigner = vm.envAddress("SERVER_SIGNER_ADDRESS");

        vm.startBroadcast(deployerKey);
        CoraEscrow escrow = new CoraEscrow(treasury, serverSigner);
        vm.stopBroadcast();

        console2.log("CoraEscrow deployed at:", address(escrow));
        console2.log("  admin:       ", escrow.admin());
        console2.log("  treasury:    ", escrow.treasury());
        console2.log("  serverSigner:", escrow.serverSigner());
    }
}
