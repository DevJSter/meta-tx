// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EIPMetaTx.sol";
import "../src/Minting.sol";

contract DeployAllScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Starting Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // Deploy MetaTx contract first
        MetaTxInteraction metaTxContract = new MetaTxInteraction();
        console.log("MetaTxInteraction deployed at:", address(metaTxContract));

        // Deploy Qobit Token contract
        QobitToken qobitToken = new QobitToken();
        console.log("QobitToken deployed at:", address(qobitToken));

        // Configure the contracts to work together
        metaTxContract.setMintingContract(address(qobitToken));
        qobitToken.setMetaTxContract(address(metaTxContract));

        // Set up relayer authorization (using deployer as initial relayer)
        metaTxContract.setAuthorizedRelayer(deployer);

        // Verify initial state
        console.log("=== Verification ===");
        console.log("MetaTx minting contract:", address(metaTxContract.mintingContract()));
        console.log("QobitToken meta contract:", qobitToken.metaTxContract());
        console.log("Authorized relayer:", metaTxContract.authorizedRelayer());
        console.log("QobitToken total supply: %d tokens", qobitToken.totalSupply() / 1e18);
        console.log("QobitToken deployer balance: %d tokens", qobitToken.balanceOf(deployer) / 1e18);

        // Display interaction types for reference
        console.log("=== Configured Interaction Types ===");
        (uint256 basePoints, uint256 cooldown, bool isActive) = metaTxContract.interactionTypes("like_post");
        console.log("like_post: base=%d cooldown=%d active=%s", basePoints, cooldown, isActive ? "true" : "false");

        (basePoints, cooldown, isActive) = metaTxContract.interactionTypes("create_post");
        console.log("create_post: base=%d cooldown=%d active=%s", basePoints, cooldown, isActive ? "true" : "false");

        console.log("=== Deployment Summary ===");
        console.log("MetaTx Contract:", address(metaTxContract));
        console.log("Qobit Token:", address(qobitToken));
        console.log("Relayer Address:", deployer);
        console.log("Domain Separator:", vm.toString(metaTxContract.DOMAIN_SEPARATOR()));
        console.log("Ready for AI relayer service!");
        console.log("=========================");

        vm.stopBroadcast();
    }
}
