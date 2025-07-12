// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Forwarder.sol";
import "../src/Paymaster.sol";
import "../src/SampleContract.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MinimalForwarder
        MinimalForwarder forwarder = new MinimalForwarder();
        console.log("MinimalForwarder deployed at:", address(forwarder));

        // Deploy Paymaster
        Paymaster paymaster = new Paymaster(address(forwarder));
        console.log("Paymaster deployed at:", address(paymaster));

        // Add paymaster as trusted in forwarder
        forwarder.addTrustedPaymaster(address(paymaster));
        console.log("Paymaster added as trusted forwarder");

        // Deploy sample contract
        SampleERC2771Contract sampleContract = new SampleERC2771Contract(address(forwarder));
        console.log("SampleERC2771Contract deployed at:", address(sampleContract));

        // Add sample contract as sponsored in paymaster
        paymaster.setSponsoredContract(address(sampleContract), true);
        console.log("Sample contract added as sponsored");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("Forwarder:", address(forwarder));
        console.log("Paymaster:", address(paymaster));
        console.log("Sample Contract:", address(sampleContract));
    }
}