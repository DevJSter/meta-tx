// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IncrementalMerkleTree
 * @dev Library for managing incremental Merkle trees with efficient insertion
 * Supports trees with depth up to 32 levels (2^32 leaves maximum)
 */
library IncrementalMerkleTree {
    struct Tree {
        uint256 depth;
        uint256 nextIndex;
        bytes32 root;
        mapping(uint256 => bytes32) nodes; // level => node hash
        mapping(uint256 => bytes32) zeros; // level => zero hash
    }
    
    /**
     * @dev Initialize a new incremental Merkle tree
     * @param tree The tree storage reference
     * @param _depth The depth of the tree (1-32)
     */

    function initialize(Tree storage tree, uint256 _depth) internal {
        require(_depth > 0 && _depth <= 32, "IMT: Invalid depth");
        
        tree.depth = _depth;
        tree.nextIndex = 0;
        
        // Pre-compute zero hashes for each level
        bytes32 currentZero = bytes32(0);
        for (uint256 i = 0; i < _depth; i++) {
            tree.zeros[i] = currentZero;
            currentZero = keccak256(abi.encodePacked(currentZero, currentZero));
        }
        
        tree.root = currentZero;
    }
    
    /**
     * @dev Insert a new leaf into the tree
     * @param tree The tree storage reference
     * @param leaf The leaf hash to insert
     * @return index The index where the leaf was inserted
     */
    function insert(Tree storage tree, bytes32 leaf) internal returns (uint256) {
        uint256 index = tree.nextIndex;
        require(index < (1 << tree.depth), "IMT: Tree is full");
        
        bytes32 currentHash = leaf;
        uint256 currentIndex = index;
        
        // Update the path from leaf to root
        for (uint256 level = 0; level < tree.depth; level++) {
            if (currentIndex % 2 == 0) {
                // Left child - store the hash and use zero for right sibling
                tree.nodes[level] = currentHash;
                currentHash = keccak256(abi.encodePacked(currentHash, tree.zeros[level]));
            } else {
                // Right child - combine with stored left sibling
                bytes32 leftSibling = tree.nodes[level];
                currentHash = keccak256(abi.encodePacked(leftSibling, currentHash));
            }
            currentIndex >>= 1;
        }
        
        tree.root = currentHash;
        tree.nextIndex++;
        
        return index;
    }
    
    /**
     * @dev Get the current root of the tree
     * @param tree The tree storage reference
     * @return The current root hash
     */
    function getRoot(Tree storage tree) internal view returns (bytes32) {
        return tree.root;
    }
    
    /**
     * @dev Get the next available index for insertion
     * @param tree The tree storage reference
     * @return The next index
     */
    function getNextIndex(Tree storage tree) internal view returns (uint256) {
        return tree.nextIndex;
    }
    
    /**
     * @dev Check if the tree is full
     * @param tree The tree storage reference
     * @return True if tree is full
     */
    function isFull(Tree storage tree) internal view returns (bool) {
        return tree.nextIndex >= (1 << tree.depth);
    }
    
    /**
     * @dev Get the maximum capacity of the tree
     * @param tree The tree storage reference
     * @return The maximum number of leaves
     */
    function getCapacity(Tree storage tree) internal view returns (uint256) {
        return 1 << tree.depth;
    }
    
    /**
     * @dev Generate merkle proof for a given index
     * @param tree The tree storage reference
     * @param index The leaf index
     * @return proof Array of sibling hashes for the proof path
     */
    function generateProof(Tree storage tree, uint256 index) internal view returns (bytes32[] memory proof) {
        require(index < tree.nextIndex, "IMT: Index out of bounds");
        
        proof = new bytes32[](tree.depth);
        uint256 currentIndex = index;
        
        for (uint256 level = 0; level < tree.depth; level++) {
            uint256 siblingIndex;
            if (currentIndex % 2 == 0) {
                // We are at a left node, sibling is to the right
                siblingIndex = currentIndex + 1;
                if (siblingIndex < (1 << (tree.depth - level)) && 
                    siblingIndex < tree.nextIndex * (1 << level) / (1 << level)) {
                    // Right sibling exists
                    proof[level] = tree.nodes[level];
                } else {
                    // Use zero hash
                    proof[level] = tree.zeros[level];
                }
            } else {
                // We are at a right node, sibling is to the left
                proof[level] = tree.nodes[level];
            }
            currentIndex >>= 1;
        }
    }
    
    /**
     * @dev Verify a merkle proof
     * @param root The merkle root to verify against
     * @param leaf The leaf value
     * @param index The leaf index
     * @param proof The merkle proof
     * @return True if proof is valid
     */
    function verifyProof(
        bytes32 root,
        bytes32 leaf,
        uint256 index,
        bytes32[] memory proof
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        uint256 currentIndex = index;
        
        for (uint256 i = 0; i < proof.length; i++) {
            if (currentIndex % 2 == 0) {
                // Left child
                computedHash = keccak256(abi.encodePacked(computedHash, proof[i]));
            } else {
                // Right child
                computedHash = keccak256(abi.encodePacked(proof[i], computedHash));
            }
            currentIndex >>= 1;
        }
        
        return computedHash == root;
    }
}
