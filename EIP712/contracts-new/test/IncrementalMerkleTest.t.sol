// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/IncrementalMerkleTree.sol";

contract TestTreeContainer {
    using IncrementalMerkleTree for IncrementalMerkleTree.Tree;
    
    IncrementalMerkleTree.Tree public tree;
    
    constructor(uint256 depth) {
        tree.initialize(depth);
    }
    
    function insert(bytes32 leaf) external returns (uint256) {
        return tree.insert(leaf);
    }
    
    function getRoot() external view returns (bytes32) {
        return tree.getRoot();
    }
    
    function getNextIndex() external view returns (uint256) {
        return tree.getNextIndex();
    }
    
    function isFull() external view returns (bool) {
        return tree.isFull();
    }
    
    function getCapacity() external view returns (uint256) {
        return tree.getCapacity();
    }
    
    function generateProof(uint256 index) external view returns (bytes32[] memory) {
        return tree.generateProof(index);
    }
}

contract IncrementalMerkleTest is Test {
    TestTreeContainer public testTree;
    
    function setUp() public {
        testTree = new TestTreeContainer(10); // Depth 10 for testing
    }
    
    function testInitialization() public {
        assertEq(testTree.getNextIndex(), 0);
        assertEq(testTree.getCapacity(), 1024); // 2^10
        assertFalse(testTree.isFull());
    }
    
    function testSingleLeafInsertion() public {
        bytes32 leaf = keccak256("test leaf");
        
        uint256 index = testTree.insert(leaf);
        
        assertEq(index, 0);
        assertEq(testTree.getNextIndex(), 1);
        
        // Root should not be zero
        bytes32 root = testTree.getRoot();
        assertTrue(root != bytes32(0));
    }
    
    function testMultipleLeafInsertion() public {
        bytes32 leaf1 = keccak256("leaf 1");
        bytes32 leaf2 = keccak256("leaf 2");
        bytes32 leaf3 = keccak256("leaf 3");
        
        uint256 index1 = testTree.insert(leaf1);
        uint256 index2 = testTree.insert(leaf2);
        uint256 index3 = testTree.insert(leaf3);
        
        assertEq(index1, 0);
        assertEq(index2, 1);
        assertEq(index3, 2);
        assertEq(testTree.getNextIndex(), 3);
    }
    
    function testMerkleProofVerification() public {
        bytes32 leaf1 = keccak256("leaf 1");
        bytes32 leaf2 = keccak256("leaf 2");
        
        testTree.insert(leaf1);
        testTree.insert(leaf2);
        
        bytes32 root = testTree.getRoot();
        bytes32[] memory proof1 = testTree.generateProof(0);
        bytes32[] memory proof2 = testTree.generateProof(1);
        
        // Verify proofs
        assertTrue(IncrementalMerkleTree.verifyProof(root, leaf1, 0, proof1));
        assertTrue(IncrementalMerkleTree.verifyProof(root, leaf2, 1, proof2));
        
        // Invalid proofs should fail
        assertFalse(IncrementalMerkleTree.verifyProof(root, leaf1, 1, proof1));
        assertFalse(IncrementalMerkleTree.verifyProof(root, leaf2, 0, proof2));
    }
    
    function testTreeCapacity() public {
        TestTreeContainer smallTree = new TestTreeContainer(3); // Depth 3, capacity 8
        
        assertEq(smallTree.getCapacity(), 8);
        assertFalse(smallTree.isFull());
        
        // Insert 8 leaves
        for (uint256 i = 0; i < 8; i++) {
            bytes32 leaf = keccak256(abi.encodePacked("leaf", i));
            smallTree.insert(leaf);
        }
        
        assertTrue(smallTree.isFull());
        
        // Next insertion should fail
        vm.expectRevert("IMT: Tree is full");
        smallTree.insert(keccak256("overflow leaf"));
    }
}
