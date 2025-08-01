// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IncrementalMerkleTree, OptimizedIncrementalMerkle} from "../src/IncrementalMerkle.sol";

contract DeployIncrementalMerkle is Script {
    IncrementalMerkleTree public incrementalTree;
    OptimizedIncrementalMerkle public optimizedTree;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy both versions
        incrementalTree = new IncrementalMerkleTree();
        optimizedTree = new OptimizedIncrementalMerkle();

        console.log("IncrementalMerkleTree deployed to:", address(incrementalTree));
        console.log("OptimizedIncrementalMerkle deployed to:", address(optimizedTree));

        // Demonstrate basic functionality
        console.log("\n=== Testing IncrementalMerkleTree ===");
        
        // Test adding leaves
        bytes32 leaf1 = keccak256("alice -> bob");
        bytes32 leaf2 = keccak256("bob -> charlie");
        bytes32 leaf3 = keccak256("charlie -> dave");
        
        uint256 index1 = incrementalTree.addLeaf(leaf1);
        uint256 index2 = incrementalTree.addLeaf(leaf2);
        uint256 index3 = incrementalTree.addLeaf(leaf3);
        
        console.log("Added leaf 1 at index:", index1);
        console.log("Added leaf 2 at index:", index2); 
        console.log("Added leaf 3 at index:", index3);
        
        console.log("Current leaf count:", incrementalTree.leafCount());
        console.log("Current root:", vm.toString(incrementalTree.root()));
        
        // Test updating a leaf
        bytes32 newLeaf = keccak256("alice -> updated");
        incrementalTree.updateLeaf(0, newLeaf);
        console.log("Updated root after leaf update:", vm.toString(incrementalTree.root()));
        
        console.log("\n=== Testing OptimizedIncrementalMerkle ===");
        
        // Test optimized version
        uint256 optIndex1 = optimizedTree.insertLeaf(leaf1);
        uint256 optIndex2 = optimizedTree.insertLeaf(leaf2);
        
        console.log("Optimized tree - Added leaves at indices:", optIndex1, optIndex2);
        console.log("Optimized tree - Current leaf count:", optimizedTree.leafCount());
        console.log("Optimized tree - Current root:", vm.toString(optimizedTree.root()));

        vm.stopBroadcast();
    }
}
