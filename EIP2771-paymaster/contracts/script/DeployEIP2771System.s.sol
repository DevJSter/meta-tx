// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/EIP2771Forwarder.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/OwnerFundedPaymaster.sol";

/**
 * @title DeployEIP2771System
 * @dev Professional deployment script for the complete EIP2771 system
 */
contract DeployEIP2771System is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy EIP2771 Forwarder
        EIP2771Forwarder forwarder = new EIP2771Forwarder(deployer);
        console.log("EIP2771Forwarder deployed at:", address(forwarder));
        
        // Deploy Meta Transaction Paymaster
        MetaTransactionPaymaster paymaster = new MetaTransactionPaymaster(
            address(forwarder),
            deployer
        );
        console.log("MetaTransactionPaymaster deployed at:", address(paymaster));
        
        // Deploy Owner Funded Paymaster
        OwnerFundedPaymaster ownerPaymaster = new OwnerFundedPaymaster(
            address(forwarder),
            deployer
        );
        console.log("OwnerFundedPaymaster deployed at:", address(ownerPaymaster));
        
        // Add paymasters as trusted in the forwarder
        forwarder.addTrustedPaymaster(address(paymaster));
        forwarder.addTrustedPaymaster(address(ownerPaymaster));
        
        console.log("=== EIP2771 System Deployment Complete ===");
        console.log("Forwarder:", address(forwarder));
        console.log("MetaTransactionPaymaster:", address(paymaster));
        console.log("OwnerFundedPaymaster:", address(ownerPaymaster));
        
        vm.stopBroadcast();
    }
}
