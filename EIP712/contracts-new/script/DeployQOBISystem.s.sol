// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import "../src/QOBISystemDeployer.sol";

/**
 * @title DeployQOBISystem
 * @dev Forge script to deploy the complete QOBI social mining system
 */
contract DeployQOBISystem is Script {
    QOBISystemDeployer public deployer;
    
    // Configuration parameters
    address public aiValidator;
    address[] public relayers;
    address public stabilizer;
    uint256 public initialRelayerFunding = 0.1 ether; // 0.1 QOBI per relayer
    
    function setUp() public {
        // Set up configuration based on environment
        // In production, these would come from environment variables
        
        // For testing, we'll use the deployer as the initial validator/stabilizer
        aiValidator = vm.envOr("AI_VALIDATOR", msg.sender);
        stabilizer = vm.envOr("STABILIZER", msg.sender);
        
        // Add some sample relayers (in production, these would be real addresses)
        relayers.push(vm.envOr("RELAYER_1", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8))); // Anvil account 1
        relayers.push(vm.envOr("RELAYER_2", address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC))); // Anvil account 2  
        relayers.push(vm.envOr("RELAYER_3", address(0x90F79bf6EB2c4f870365E785982E1f101E93b906))); // Anvil account 3
        
        console.log("Configuration:");
        console.log("AI Validator:", aiValidator);
        console.log("Stabilizer:", stabilizer);
        console.log("Number of relayers:", relayers.length);
        console.log("Initial relayer funding:", initialRelayerFunding);
    }
    
    function run() public {
        // Use the private key from command line or fall back to default anvil key
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying QOBI Social Mining System...");
        console.log("Deployer address:", vm.addr(deployerPrivateKey));
        console.log("Chain ID:", block.chainid);
        
        // Deploy the system deployer
        deployer = new QOBISystemDeployer();
        console.log("QOBISystemDeployer deployed at:", address(deployer));
        
        // Calculate total funding needed
        uint256 totalFunding = relayers.length * initialRelayerFunding;
        uint256 distributorFunding = 10 ether; // Initial funding for distributor
        uint256 totalRequired = totalFunding + distributorFunding;
        
        console.log("Total funding required:", totalRequired);
        
        // Deploy and setup the complete system
        deployer.deployAndSetupSystem{value: totalRequired}(
            aiValidator,
            relayers,
            stabilizer,
            initialRelayerFunding
        );
        
        // Get deployed contract addresses
        (
            address accessControl,
            address stabilizing,
            address treeGenerator,
            address merkleDistributor,
            address relayerTreasury
        ) = deployer.getDeployedContracts();
        
        // Log all deployed addresses
        console.log("\n=== DEPLOYED CONTRACTS ===");
        console.log("QOBISystemDeployer:", address(deployer));
        console.log("QOBIAccessControl:", accessControl);
        console.log("StabilizingContract:", stabilizing);
        console.log("DailyTreeGenerator:", treeGenerator);
        console.log("QOBIMerkleDistributor:", merkleDistributor);
        console.log("RelayerTreasury:", relayerTreasury);
        
        // Log configuration
        console.log("\n=== CONFIGURATION ===");
        console.log("AI Validator:", aiValidator);
        console.log("Stabilizer:", stabilizer);
        console.log("Relayers:");
        for (uint256 i = 0; i < relayers.length; i++) {
            console.log("  Relayer", i + 1, ":", relayers[i]);
        }
        
        // Verify system is properly deployed
        require(deployer.isSystemDeployed(), "System deployment failed");
        console.log("System deployment successful!");
        
        vm.stopBroadcast();
        
        // Save deployment info to file
        _saveDeploymentInfo(
            accessControl,
            stabilizing,
            treeGenerator,
            merkleDistributor,
            relayerTreasury
        );
    }
    
    function _saveDeploymentInfo(
        address accessControl,
        address stabilizing,
        address treeGenerator,
        address merkleDistributor,
        address relayerTreasury
    ) internal {
        string memory json = "deployment";
        
        vm.serializeAddress(json, "deployer", address(deployer));
        vm.serializeAddress(json, "accessControl", accessControl);
        vm.serializeAddress(json, "stabilizing", stabilizing);
        vm.serializeAddress(json, "treeGenerator", treeGenerator);
        vm.serializeAddress(json, "merkleDistributor", merkleDistributor);
        vm.serializeAddress(json, "relayerTreasury", relayerTreasury);
        vm.serializeAddress(json, "aiValidator", aiValidator);
        vm.serializeAddress(json, "stabilizer", stabilizer);
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "blockNumber", block.number);
        string memory finalJson = vm.serializeUint(json, "timestamp", block.timestamp);
        
        string memory fileName = string.concat("deployment-", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, string.concat("./broadcast/", fileName));
        
        console.log("\nDeployment info saved to:", fileName);
    }
    
    // Helper function to fund the system after deployment
    function fundSystem() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        (, , , address merkleDistributor, ) = deployer.getDeployedContracts();
        
        // Send additional funding to the distributor
        uint256 additionalFunding = 100 ether; // 100 QOBI
        payable(merkleDistributor).transfer(additionalFunding);
        
        console.log("Sent", additionalFunding, "to merkle distributor");
        
        vm.stopBroadcast();
    }
    
    // Helper function to update system configuration
    function updateConfiguration() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Example: Update daily limits
        uint256[6] memory userLimits = [
            uint256(2000),  // CREATE: 2000 users max
            uint256(10000), // LIKES: 10000 users max
            uint256(6000),  // COMMENTS: 6000 users max
            uint256(1000),  // TIPPING: 1000 users max
            uint256(500),   // CRYPTO: 500 users max
            uint256(200)    // REFERRALS: 200 users max
        ];
        
        uint256[6] memory qobiCaps = [
            uint256(1.49 ether),  // CREATE: 1.49 QOBI
            uint256(0.05 ether),  // LIKES: 0.05 QOBI  
            uint256(0.6 ether),   // COMMENTS: 0.6 QOBI
            uint256(7.96 ether),  // TIPPING: 7.96 QOBI
            uint256(9.95 ether),  // CRYPTO: 9.95 QOBI
            uint256(11.95 ether)  // REFERRALS: 11.95 QOBI
        ];
        
        deployer.updateAllDailyLimits(userLimits, qobiCaps);
        
        console.log("Updated daily limits and QOBI caps");
        
        vm.stopBroadcast();
    }
}
