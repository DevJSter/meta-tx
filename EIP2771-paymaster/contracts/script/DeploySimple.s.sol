// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/EIP2771Forwarder.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/OwnerFundedPaymaster.sol";
import "../src/SampleContract.sol";

contract DeploySimple is Script {
    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;

        // Deploy EIP2771 Forwarder
        EIP2771Forwarder forwarder = new EIP2771Forwarder(deployer);
        console.log("EIP2771Forwarder deployed at:", address(forwarder));

        // Deploy Meta Transaction Paymaster
        MetaTransactionPaymaster paymaster = new MetaTransactionPaymaster(address(forwarder), deployer);
        console.log("MetaTransactionPaymaster deployed at:", address(paymaster));

        // Deploy Owner Funded Paymaster
        OwnerFundedPaymaster ownerPaymaster = new OwnerFundedPaymaster(address(forwarder), deployer);
        console.log("OwnerFundedPaymaster deployed at:", address(ownerPaymaster));

        // Deploy Sample Contract
        SampleERC2771Contract sampleContract = new SampleERC2771Contract(address(forwarder), deployer);
        console.log("SampleERC2771Contract deployed at:", address(sampleContract));

        // Configure system
        forwarder.addTrustedPaymaster(address(paymaster));
        forwarder.addTrustedPaymaster(address(ownerPaymaster));

        paymaster.setSponsoredContract(address(sampleContract), true);
        ownerPaymaster.setSponsoredContract(address(sampleContract), true);

        // Fund paymasters
        paymaster.depositCredits{value: 1 ether}(deployer);
        ownerPaymaster.ownerDeposit{value: 1 ether}();

        console.log("System configured successfully!");

        vm.stopBroadcast();
    }
}
