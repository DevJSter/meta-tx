// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {BridgeSender} from "../src/BridgeSender.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BridgeReceiver} from "../src/BridgeReceiver.sol";
import {SubnetReceiver} from "../src/SubnetReceiver.sol";
import {AMM} from "../src/AMM.sol";

// Mock tokens for testing (deploy these first if needed)
contract MockQtoken is ERC20("Qtoken", "QTO") {
    constructor() {
        _mint(msg.sender, 1000000 * 10 ** 18); // 1M tokens
    }
}

contract MockQobi is ERC20("Qobi", "QOBI") {
    constructor() {
        _mint(msg.sender, 1000000000 * 10 ** 18); // 1B tokens for swaps
    }
}

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy mock tokens if not already deployed
        MockQtoken qtoken = new MockQtoken();
        MockQobi qobi = new MockQobi();

        // Dummy bridge endpoints (replace with actual for production)
        address ethereumBridgeEndpoint = address(0x123); // Placeholder
        address avalancheBridgeEndpoint = address(0x456); // Placeholder

        // Deploy BridgeSender (Ethereum side)
        BridgeSender bridgeSender = new BridgeSender(address(qtoken), ethereumBridgeEndpoint);

        // Deploy BridgeReceiver (Avalanche C-Chain side)
        BridgeReceiver bridgeReceiver = new BridgeReceiver(avalancheBridgeEndpoint);

        // Deploy SubnetReceiver (Qoneqt Subnet side)
        SubnetReceiver subnetReceiver = new SubnetReceiver(address(bridgeReceiver));

        // Deploy AMM (Qoneqt Subnet side)
        AMM amm = new AMM(address(qtoken), address(qobi));

        // Optional: Transfer some tokens to deployer or AMM for testing
        qtoken.transfer(address(amm), 10000 * 10 ** 18); // For liquidity if needed
        qobi.transfer(address(amm), 1000000 * 10 ** 18);

        vm.stopBroadcast();

        // Log addresses (visible in console output)
        console.log("Qtoken deployed at:", address(qtoken));
        console.log("Qobi deployed at:", address(qobi));
        console.log("BridgeSender deployed at:", address(bridgeSender));
        console.log("BridgeReceiver deployed at:", address(bridgeReceiver));
        console.log("SubnetReceiver deployed at:", address(subnetReceiver));
        console.log("AMM deployed at:", address(amm));
    }
}
