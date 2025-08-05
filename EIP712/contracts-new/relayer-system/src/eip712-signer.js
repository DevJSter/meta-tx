const { ethers } = require('ethers');

/**
 * EIP712 Signature Creator for QOBI Tree Submissions
 */
class EIP712Signer {
    constructor(contractAddress, chainId = 31337) {
        this.domain = {
            name: "QOBI TreeProcessor",
            version: "1",
            chainId: chainId,
            verifyingContract: contractAddress
        };

        this.types = {
            TreeSubmission: [
                { name: "day", type: "uint256" },
                { name: "interactionType", type: "uint8" },
                { name: "merkleRoot", type: "bytes32" },
                { name: "users", type: "address[]" },
                { name: "points", type: "uint256[]" },
                { name: "qobiAmounts", type: "uint256[]" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };
    }

    /**
     * Create a tree submission structure
     * @param {number} day - Day number (timestamp / 86400)
     * @param {number} interactionType - Interaction type (0-5)
     * @param {string} merkleRoot - Merkle root hash
     * @param {Array} userData - User data array
     * @param {number} nonce - Relayer nonce
     * @param {number} deadline - Expiry timestamp
     * @returns {Object} Tree submission structure
     */
    createSubmission(day, interactionType, merkleRoot, userData, nonce, deadline) {
        const users = userData.map(data => data.user);
        const points = userData.map(data => data.points);
        const qobiAmounts = userData.map(data => data.qobiAmount);

        return {
            day,
            interactionType,
            merkleRoot,
            users,
            points,
            qobiAmounts,
            nonce,
            deadline
        };
    }

    /**
     * Sign a tree submission with EIP712
     * @param {Object} submission - Tree submission data
     * @param {ethers.Wallet} signer - Wallet to sign with
     * @returns {string} Signature
     */
    async signSubmission(submission, signer) {
        try {
            const signature = await signer.signTypedData(
                this.domain,
                this.types,
                submission
            );
            return signature;
        } catch (error) {
            throw new Error(`Failed to sign submission: ${error.message}`);
        }
    }

    /**
     * Helper method to sign tree submission with individual parameters
     * @param {ethers.Wallet} wallet - Wallet to sign with
     * @param {number} day - Day number
     * @param {number} interactionType - Interaction type (0-5)
     * @param {string} merkleRoot - Merkle root hash
     * @param {Array} users - Array of user addresses
     * @param {Array} amounts - Array of QOBI amounts
     * @returns {string} Signature
     */
    async signSubmissionHelper(wallet, day, interactionType, merkleRoot, users, amounts) {
        const nonce = Math.floor(Math.random() * 1000000); // Random nonce for demo
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        // Convert amounts to proper format if needed
        const points = amounts.map(() => Math.floor(Math.random() * 80) + 20); // Random points for demo
        
        const submission = {
            day,
            interactionType,
            merkleRoot,
            users,
            points,
            qobiAmounts: amounts,
            nonce,
            deadline
        };
        
        return await this.signSubmission(submission, wallet);
    }

    /**
     * Verify a signature
     * @param {Object} submission - Tree submission data
     * @param {string} signature - Signature to verify
     * @returns {string} Recovered signer address
     */
    verifySignature(submission, signature) {
        try {
            const recoveredAddress = ethers.verifyTypedData(
                this.domain,
                this.types,
                submission,
                signature
            );
            return recoveredAddress;
        } catch (error) {
            throw new Error(`Failed to verify signature: ${error.message}`);
        }
    }

    /**
     * Get domain separator hash
     * @returns {string} Domain separator
     */
    getDomainSeparator() {
        return ethers.TypedDataEncoder.hashDomain(this.domain);
    }

    /**
     * Get submission hash
     * @param {Object} submission - Tree submission data
     * @returns {string} Submission hash
     */
    getSubmissionHash(submission) {
        return ethers.TypedDataEncoder.hash(this.domain, this.types, submission);
    }
}

module.exports = { EIP712Signer };
