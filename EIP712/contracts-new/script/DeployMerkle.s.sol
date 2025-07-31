// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TestMerkleProof} from "../src/Merkle.sol";

contract DeployMerkle is Script {
    TestMerkleProof public testMerkleProof;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        testMerkleProof = new TestMerkleProof();

        console.log("TestMerkleProof deployed to:", address(testMerkleProof));
        console.log("Merkle root:", vm.toString(testMerkleProof.getRoot()));

        vm.stopBroadcast();
    }
}
