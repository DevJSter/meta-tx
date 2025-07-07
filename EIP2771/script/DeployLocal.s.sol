// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AIValidatedForwarder.sol";
import "../src/MetaTxInteractionRecipient.sol";

contract DeployLocal is Script {
    function run() external {
        // Use the first Anvil account for deployment
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the AI-validated forwarder
        AIValidatedForwarder forwarder = new AIValidatedForwarder("QoneqtAIForwarder");
        console.log("AIValidatedForwarder deployed at:", address(forwarder));
        
        // Deploy the recipient contract with the forwarder as trusted forwarder
        MetaTxInteractionRecipient recipient = new MetaTxInteractionRecipient(address(forwarder));
        console.log("MetaTxInteractionRecipient deployed at:", address(recipient));
        
        vm.stopBroadcast();
        
        // Log deployment info for easy copy-paste into client
        console.log("\n=== Copy these addresses to client/signer.js ===");
        console.log("const FORWARDER_ADDRESS = '%s';", address(forwarder));
        console.log("const RECIPIENT_ADDRESS = '%s';", address(recipient));
        console.log("\nChain ID:", block.chainid);
    }
}
