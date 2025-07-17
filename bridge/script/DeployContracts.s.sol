// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {CChainQobitLock} from "../src/CChainQobitLock.sol";
import {RChainQobitSwap} from "../src/RChainQobitSwap.sol";
import {QobitToken} from "../src/QobitToken.sol";

contract DeployContracts is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy QobitToken
        QobitToken qobit = new QobitToken();
        address qobitAddr = address(qobit);

        // Deploy RChainQobitSwap with placeholder cChainContract
        RChainQobitSwap rChain = new RChainQobitSwap(qobitAddr, address(0));

        // Deploy CChainQobitLock with rChain address
        CChainQobitLock cChain = new CChainQobitLock(address(rChain), qobitAddr);

        // Set the actual cChainContract on RChainQobitSwap
        rChain.setCChainContract(address(cChain));

        vm.stopBroadcast();
    }
}
