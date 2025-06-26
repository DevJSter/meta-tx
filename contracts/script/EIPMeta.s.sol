// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EIPMetaTx.sol";

contract EIPMetaScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy the MetaTxInteraction contract
        MetaTxInteraction metaTx = new MetaTxInteraction();
        
        console.log("MetaTxInteraction deployed to:", address(metaTx));
        console.log("DOMAIN_SEPARATOR:", vm.toString(metaTx.DOMAIN_SEPARATOR()));

        vm.stopBroadcast();
    }
}