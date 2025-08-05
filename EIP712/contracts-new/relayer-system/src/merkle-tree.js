const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');

/**
 * Merkle Tree Builder for QOBI Social Mining
 * Builds efficient Merkle trees for user interaction data
 */
class MerkleTreeBuilder {
    constructor() {
        this.tree = null;
        this.leaves = [];
        this.hashFn = (data) => ethers.keccak256(data);
    }

    /**
     * Create a leaf hash from user data
     * @param {string} user - User address
     * @param {number} points - User points (0-100)
     * @param {string} qobiAmount - QOBI amount in wei
     */
    hashLeaf(user, points, qobiAmount) {
        return ethers.keccak256(
            ethers.solidityPacked(
                ['address', 'uint256', 'uint256'],
                [user, points, qobiAmount]
            )
        );
    }

    /**
     * Build Merkle tree from user data
     * @param {Array} userData - Array of {user, points, qobiAmount}
     * @returns {Object} Tree data with root, tree, and leaves
     */
    buildTree(userData) {
        if (!userData || userData.length === 0) {
            throw new Error('No user data provided');
        }

        // Create leaves
        const leaves = userData.map(data => 
            this.hashLeaf(data.user, data.points, data.qobiAmount)
        );

        // Build Merkle tree
        const tree = new MerkleTree(leaves, this.hashFn, { sortPairs: true });
        const root = tree.getRoot();

        return {
            root: '0x' + root.toString('hex'),
            tree,
            leaves,
            userData
        };
    }

    /**
     * Generate proof for a specific user
     * @param {Object} treeData - Tree data from buildTree
     * @param {string} user - User address
     * @returns {Array} Merkle proof
     */
    generateProof(treeData, user) {
        const userIndex = treeData.userData.findIndex(data => 
            data.user.toLowerCase() === user.toLowerCase()
        );

        if (userIndex === -1) {
            throw new Error('User not found in tree');
        }

        const leaf = treeData.leaves[userIndex];
        const proof = treeData.tree.getProof(leaf);
        
        return proof.map(p => '0x' + p.data.toString('hex'));
    }

    /**
     * Verify a proof
     * @param {Array} proof - Merkle proof
     * @param {string} root - Merkle root
     * @param {string} user - User address
     * @param {number} points - User points
     * @param {string} qobiAmount - QOBI amount
     * @returns {boolean} Verification result
     */
    verifyProof(proof, root, user, points, qobiAmount) {
        const leaf = this.hashLeaf(user, points, qobiAmount);
        return MerkleTree.verify(proof, leaf, root, this.hashFn, { sortPairs: true });
    }

    /**
     * Calculate total QOBI for user data
     * @param {Array} userData - User data array
     * @returns {string} Total QOBI in wei
     */
    calculateTotalQOBI(userData) {
        return userData.reduce((total, data) => {
            return ethers.getBigInt(total) + ethers.getBigInt(data.qobiAmount);
        }, 0n).toString();
    }
}

module.exports = { MerkleTreeBuilder };
