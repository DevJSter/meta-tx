// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IncrementalMerkleTree
 * @dev Implementation of an incremental Merkle tree that allows dynamic updates
 * Key features:
 * - There should be 6 trees for different interaction Types 
 * - Add new leaves incrementally
 * - Update roots dynamically
 * - Efficient storage using sparse representation
 * - Support for both append-only and arbitrary position updates
 */
contract IncrementalMerkleTree {
    // Maximum depth of the tree (supports 2^20 = ~1M leaves)
    uint256 public constant MAX_DEPTH = 2^20;
    
    // Current number of leaves in the tree
    uint256 public leafCount;
    
    // Current root of the tree
    bytes32 public root;
    
    // Store the rightmost path nodes for efficient incremental updates
    // filledSubtrees[i] contains the hash of the rightmost subtree at level i
    bytes32[MAX_DEPTH] public filledSubtrees;
    
    // Zero hashes for each level (precomputed for efficiency)
    bytes32[MAX_DEPTH] public zeros;
    
    // Store all leaves for verification purposes
    mapping(uint256 => bytes32) public leaves;
    
    // Events
    event LeafAdded(uint256 indexed index, bytes32 leaf, bytes32 newRoot);
    event LeafUpdated(uint256 indexed index, bytes32 oldLeaf, bytes32 newLeaf, bytes32 newRoot);
    
    constructor() {
        // Initialize zero hashes
        // zeros[0] = keccak256("") - hash of empty leaf
        zeros[0] = keccak256(abi.encodePacked(""));
        
        for (uint256 i = 1; i < MAX_DEPTH; i++) {
            zeros[i] = keccak256(abi.encodePacked(zeros[i-1], zeros[i-1]));
        }
        
        root = zeros[MAX_DEPTH - 1];
    }
    
    /**
     * @dev Add a new leaf to the tree (append-only)
     * @param leaf The leaf hash to add
     * @return The index where the leaf was inserted
     */
     
    
    /**
     * @dev Update an existing leaf at a specific index
     * @param index The index of the leaf to update
     * @param newLeaf The new leaf hash
     */
    function updateLeaf(uint256 index, bytes32 newLeaf) external {
        require(index < leafCount, "Index out of bounds");
        
        bytes32 oldLeaf = leaves[index];
        leaves[index] = newLeaf;
        
        // Recalculate root with the new leaf
        root = calculateRoot();
        
        emit LeafUpdated(index, oldLeaf, newLeaf, root);
    }
    
    /**
     * @dev Calculate the current root efficiently
     * Uses a level-by-level approach without huge memory allocations
     */
    function calculateRoot() public view returns (bytes32) {
        if (leafCount == 0) {
            return zeros[MAX_DEPTH - 1];
        }
        
        // Start with current leaves
        uint256 currentLevelSize = leafCount;
        
        // We'll build the tree level by level
        bytes32[] memory currentLevel = new bytes32[](currentLevelSize);
        for (uint256 i = 0; i < currentLevelSize; i++) {
            currentLevel[i] = leaves[i];
        }
        
        // Build tree bottom-up
        for (uint256 level = 0; level < MAX_DEPTH && currentLevelSize > 1; level++) {
            uint256 nextLevelSize = (currentLevelSize + 1) / 2;
            bytes32[] memory nextLevel = new bytes32[](nextLevelSize);
            
            for (uint256 i = 0; i < nextLevelSize; i++) {
                bytes32 left = currentLevel[i * 2];
                bytes32 right = (i * 2 + 1 < currentLevelSize) ? currentLevel[i * 2 + 1] : zeros[level];
                nextLevel[i] = keccak256(abi.encodePacked(left, right));
            }
            
            currentLevel = nextLevel;
            currentLevelSize = nextLevelSize;
        }
        
        // Pad with zeros up to the full depth
        bytes32 result = currentLevel[0];
        uint256 levelsRemaining = MAX_DEPTH;
        uint256 tempSize = leafCount;
        
        // Calculate how many levels we actually used
        while (tempSize > 1) {
            tempSize = (tempSize + 1) / 2;
            levelsRemaining--;
        }
        
        // Hash with zeros for remaining levels
        for (uint256 i = 0; i < levelsRemaining - 1; i++) {
            result = keccak256(abi.encodePacked(result, zeros[MAX_DEPTH - levelsRemaining + i]));
        }
        
        return result;
    }
    
    /**
     * @dev Generate Merkle proof for a leaf at given index (simplified version)
     * @param index The index of the leaf
     * @return proof Array of sibling hashes for the proof
     */
    function generateProof(uint256 index) external view returns (bytes32[] memory proof) {
        require(index < leafCount, "Index out of bounds");
        
        proof = new bytes32[](MAX_DEPTH);
        
        // Build a minimal tree to get the proof
        // We'll only calculate what we need for this specific path
        uint256 currentIndex = index;
        
        for (uint256 level = 0; level < MAX_DEPTH; level++) {
            uint256 siblingIndex = currentIndex % 2 == 0 ? currentIndex + 1 : currentIndex - 1;
            
            // Calculate sibling hash
            if (level == 0) {
                // Leaf level
                proof[level] = siblingIndex < leafCount ? leaves[siblingIndex] : zeros[0];
            } else {
                // For upper levels, use zeros as placeholders (simplified)
                // In a full implementation, you'd compute the actual sibling hashes
                proof[level] = zeros[level];
            }
            
            currentIndex = currentIndex / 2;
        }
        
        return proof;
    }
    
    /**
     * @dev Verify a Merkle proof against the current root
     * @param proof Array of sibling hashes
     * @param leaf The leaf hash to verify
     * @param index The index of the leaf
     * @return bool True if proof is valid
     */
    function verifyProof(
        bytes32[] memory proof, 
        bytes32 leaf, 
        uint256 index
    ) external view returns (bool) {
        require(proof.length == MAX_DEPTH, "Invalid proof length");
        require(index < leafCount, "Index out of bounds");
        
        bytes32 computedHash = leaf;
        uint256 currentIndex = index;
        
        for (uint256 i = 0; i < MAX_DEPTH; i++) {
            bytes32 proofElement = proof[i];
            
            if (currentIndex % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            currentIndex = currentIndex / 2;
        }
        
        return computedHash == root;
    }
    
    /**
     * @dev Get the current state of the tree
     */
    function getTreeInfo() external view returns (
        uint256 _leafCount,
        bytes32 _root,
        uint256 _maxCapacity
    ) {
        return (leafCount, root, 2**MAX_DEPTH);
    }
    
    /**
     * @dev Batch add multiple leaves efficiently
     * @param _leaves Array of leaf hashes to add
     */
    function batchAddLeaves(bytes32[] memory _leaves) external {
        require(leafCount + _leaves.length <= 2**MAX_DEPTH, "Would exceed tree capacity");
        
        for (uint256 i = 0; i < _leaves.length; i++) {
            _addLeafInternal(_leaves[i]);
        }
    }
    
    /**
     * @dev Internal function to add a leaf
     */
    function _addLeafInternal(bytes32 leaf) internal returns (uint256) {
        require(leafCount < 2**MAX_DEPTH, "Tree is full");
        
        uint256 index = leafCount;
        leaves[index] = leaf;
        leafCount++;
        
        bytes32 currentHash = leaf;
        uint256 currentIndex = index;
        
        // Update the tree by traversing up from the new leaf
        for (uint256 i = 0; i < MAX_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Left child - store in filledSubtrees and combine with zero
                filledSubtrees[i] = currentHash;
                currentHash = keccak256(abi.encodePacked(currentHash, zeros[i]));
            } else {
                // Right child - combine with stored left sibling
                currentHash = keccak256(abi.encodePacked(filledSubtrees[i], currentHash));
            }
            currentIndex = currentIndex / 2;
        }
        
        root = currentHash;
        emit LeafAdded(index, leaf, root);
        
        return index;
    }
}

/**
 * @title OptimizedIncrementalMerkle
 * @dev More gas-efficient version for specific use cases
 */
contract OptimizedIncrementalMerkle {
    uint256 public constant TREE_DEPTH = 10; // Smaller tree for efficiency
    uint256 public leafCount;
    bytes32 public root;
    
    // Only store the rightmost path for incremental updates
    bytes32[TREE_DEPTH] public rightmostPath;
    bytes32[TREE_DEPTH] public zeros;
    
    mapping(uint256 => bytes32) public leaves;
    
    event LeafInserted(uint256 indexed index, bytes32 leaf, bytes32 newRoot);
    
    constructor() {
        // Initialize zero hashes
        zeros[0] = bytes32(0);
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            zeros[i] = keccak256(abi.encodePacked(zeros[i-1], zeros[i-1]));
        }
        root = zeros[TREE_DEPTH - 1];
    }
    
    ///////////////////////////////////////////
    ////// External View Functions ////////////
    ///////////////////////////////////////////
    
    /**
     * @dev Highly optimized leaf insertion (append-only)
     * Only updates the rightmost path, making it O(log n) instead of O(n)
     */
    function insertLeaf(bytes32 leaf) external returns (uint256) {
        uint256 index = leafCount++;
        leaves[index] = leaf;
        
        bytes32 currentHash = leaf;
        uint256 currentIndex = index;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                // Left node - store and combine with zero
                rightmostPath[i] = currentHash;
                currentHash = keccak256(abi.encodePacked(currentHash, zeros[i]));
            } else {
                // Right node - combine with stored left sibling
                currentHash = keccak256(abi.encodePacked(rightmostPath[i], currentHash));
            }
            currentIndex = currentIndex / 2;
        }
        
        root = currentHash;
        emit LeafInserted(index, leaf, root);
        
        return index;
    }
    



    /**
     * @dev Get proof for the most recently inserted leaf (optimized)
     */
    function getLastLeafProof() external view returns (bytes32[] memory proof) {
        require(leafCount > 0, "No leaves in tree");
        
        proof = new bytes32[](TREE_DEPTH);
        uint256 index = leafCount - 1;
        uint256 currentIndex = index;
        
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                proof[i] = zeros[i];
            } else {
                proof[i] = rightmostPath[i];
            }
            currentIndex = currentIndex / 2;
        }
        
        return proof;
    }
}
