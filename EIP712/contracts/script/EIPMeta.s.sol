// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EIPMetaTx.sol";
import "../src/Minting.sol";

contract EIPMetaScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy the MetaTxInteraction contract
        MetaTxInteraction metaTx = new MetaTxInteraction();
        console.log("MetaTxInteraction deployed to:", address(metaTx));
        console.log("DOMAIN_SEPARATOR:", vm.toString(metaTx.DOMAIN_SEPARATOR()));

        // Deploy the QobitToken contract
        QobitToken qobitToken = new QobitToken();
        console.log("QobitToken deployed to:", address(qobitToken));

        // Configure the contracts to work together
        metaTx.setMintingContract(address(qobitToken));
        qobitToken.setMetaTxContract(address(metaTx));

        console.log("Contracts configured successfully!");

        vm.stopBroadcast();
    }
}
