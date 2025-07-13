// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/EIP2771Forwarder.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/OwnerFundedPaymaster.sol";
import "../src/SampleContract.sol";

contract DeploySimplified is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying EIP2771 contracts with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        // Deploy EIP2771Forwarder
        EIP2771Forwarder forwarder = new EIP2771Forwarder(deployer);
        console.log("EIP2771Forwarder deployed at:", address(forwarder));
        
        // Deploy MetaTransactionPaymaster
        MetaTransactionPaymaster paymaster = new MetaTransactionPaymaster(address(forwarder), deployer);
        console.log("MetaTransactionPaymaster deployed at:", address(paymaster));
        
        // Deploy OwnerFundedPaymaster
        OwnerFundedPaymaster ownerPaymaster = new OwnerFundedPaymaster(address(forwarder), deployer);
        console.log("OwnerFundedPaymaster deployed at:", address(ownerPaymaster));
        
        // Deploy SampleContract
        SampleERC2771Contract sampleContract = new SampleERC2771Contract(address(forwarder), deployer);
        console.log("SampleERC2771Contract deployed at:", address(sampleContract));
        
        // Setup relationships
        forwarder.addTrustedPaymaster(address(paymaster));
        forwarder.addTrustedPaymaster(address(ownerPaymaster));
        
        paymaster.setSponsoredContract(address(sampleContract), true);
        ownerPaymaster.setSponsoredContract(address(sampleContract), true);
        
        // Fund the paymasters
        paymaster.depositCredits{value: 1 ether}(deployer);
        ownerPaymaster.ownerDeposit{value: 1 ether}();
        
        console.log("Paymasters funded with 1 ETH each");
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("EIP2771Forwarder:", address(forwarder));
        console.log("MetaTransactionPaymaster:", address(paymaster));
        console.log("OwnerFundedPaymaster:", address(ownerPaymaster));
        console.log("SampleERC2771Contract:", address(sampleContract));
        console.log("User-funded Paymaster Balance:", address(paymaster).balance);
        console.log("Owner-funded Paymaster Balance:", address(ownerPaymaster).balance);
        
        console.log("\n=== Usage Instructions ===");
        console.log("1. Users can deposit credits to MetaTransactionPaymaster for sponsored transactions");
        console.log("2. OwnerFundedPaymaster sponsors transactions for free (owner pays)");
        console.log("3. Use forwarder.executeSponsoredTransaction() for sponsored transactions");
        console.log("4. Use forwarder.executeMetaTransaction() for regular meta-transactions");
        console.log("5. All transactions can be relayed by anyone - no special relayer needed!");
    }
}
