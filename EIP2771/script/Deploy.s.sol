// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AIValidatedForwarder.sol";
import "../src/MetaTxInteractionRecipient.sol";

contract DeployContracts is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the AI-validated forwarder
        AIValidatedForwarder forwarder = new AIValidatedForwarder("QoneqtAIForwarder");
        console.log("AIValidatedForwarder deployed at:", address(forwarder));
        
        // Deploy the recipient contract with the forwarder as trusted forwarder
        MetaTxInteractionRecipient recipient = new MetaTxInteractionRecipient(address(forwarder));
        console.log("MetaTxInteractionRecipient deployed at:", address(recipient));
        
        vm.stopBroadcast();
        
        // Log deployment info
        console.log("\n=== Deployment Summary ===");
        console.log("Forwarder Address:", address(forwarder));
        console.log("Recipient Address:", address(recipient));
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
    }
}
