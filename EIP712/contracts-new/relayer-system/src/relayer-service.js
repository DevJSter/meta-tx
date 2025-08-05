const { ethers } = require('ethers');
const { AIValidator } = require('./ai-validator');
const { MerkleTreeBuilder } = require('./merkle-tree');
const { EIP712Signer } = require('./eip712-signer');
require('dotenv').config();

/**
 * Relayer service that processes AI validation and submits trees to blockchain
 */
class RelayerService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.aiValidator = new AIValidator(process.env.OLLAMA_URL, process.env.OLLAMA_MODEL);
        this.merkleBuilder = new MerkleTreeBuilder();
        this.eip712Signer = new EIP712Signer();
        
        // Contract instances
        this.contracts = this.initializeContracts();
        
        console.log('🚀 QOBI Relayer Service initialized');
        console.log(`Relayer address: ${this.wallet.address}`);
    }

    /**
     * Initialize contract instances
     */
    initializeContracts() {
        const systemDeployerABI = [
            "function dailyTreeGenerator() view returns (address)",
            "function merkleDistributor() view returns (address)",
            "function accessControl() view returns (address)"
        ];

        const dailyTreeABI = [
            "function submitDailyTree(uint256 day, uint256 interactionType, bytes32 merkleRoot, address[] users, uint256[] amounts, bytes signature) external",
            "function getDailyTree(uint256 day, uint256 interactionType) view returns (bytes32, address[], uint256[], bool)",
            "function getCurrentDay() view returns (uint256)"
        ];

        const accessControlABI = [
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function RELAYER_ROLE() view returns (bytes32)",
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
        ];

        return {
            systemDeployer: new ethers.Contract(process.env.SYSTEM_DEPLOYER_ADDRESS, systemDeployerABI, this.wallet),
            dailyTree: new ethers.Contract(process.env.DAILY_TREE_ADDRESS, dailyTreeABI, this.wallet),
            accessControl: new ethers.Contract(process.env.ACCESS_CONTROL_ADDRESS, accessControlABI, this.wallet)
        };
    }

    /**
     * Check if relayer has proper permissions
     */
    async checkPermissions() {
        try {
            // Try to get the RELAYER_ROLE constant
            let relayerRole;
            try {
                relayerRole = await this.contracts.accessControl.RELAYER_ROLE();
            } catch (error) {
                // If RELAYER_ROLE() doesn't exist, use the keccak256 hash directly
                relayerRole = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));
                console.log('Using computed RELAYER_ROLE hash:', relayerRole);
            }
            
            const hasRole = await this.contracts.accessControl.hasRole(relayerRole, this.wallet.address);
            
            console.log(`Relayer role check: ${hasRole ? '✅ Authorized' : '❌ Not authorized'}`);
            console.log(`Relayer address: ${this.wallet.address}`);
            console.log(`Role hash: ${relayerRole}`);
            
            return hasRole;
        } catch (error) {
            console.error('Permission check failed:', error.message);
            return false;
        }
    }

    /**
     * Process daily trees for all interaction types
     */
    async processDailyTrees() {
        console.log('\n🔄 Starting daily tree processing...');
        
        try {
            // Test AI connection first
            const aiConnected = await this.aiValidator.testConnection();
            if (!aiConnected) {
                throw new Error('AI validator not available');
            }

            // Check permissions
            const hasPermission = await this.checkPermissions();
            if (!hasPermission) {
                throw new Error('Relayer not authorized');
            }

            // Get current day
            const currentDay = await this.contracts.dailyTree.getCurrentDay();
            console.log(`📅 Processing trees for day: ${currentDay}`);

            // Process each interaction type
            const results = [];
            for (let interactionType = 0; interactionType < 6; interactionType++) {
                try {
                    const result = await this.processInteractionType(currentDay, interactionType);
                    results.push(result);
                    
                    // Add delay between submissions to avoid nonce issues
                    await this.delay(2000);
                } catch (error) {
                    console.error(`Failed to process interaction type ${interactionType}:`, error.message);
                    results.push({ interactionType, success: false, error: error.message });
                }
            }

            console.log('\n📊 Daily processing complete:');
            results.forEach(result => {
                const typeName = this.aiValidator.interactionTypes[result.interactionType];
                console.log(`  ${typeName}: ${result.success ? '✅' : '❌'} ${result.userCount || 0} users`);
            });

            return results;
        } catch (error) {
            console.error('Daily processing failed:', error.message);
            throw error;
        }
    }

    /**
     * Process single interaction type for a day
     */
    async processInteractionType(day, interactionType) {
        const typeName = this.aiValidator.interactionTypes[interactionType];
        console.log(`\n🤖 Processing ${typeName} interactions...`);

        try {
            // Check if tree already exists
            const existingTree = await this.contracts.dailyTree.getDailyTree(day, interactionType);
            if (existingTree[3]) { // isSubmitted
                console.log(`⏭️  Tree already submitted for ${typeName}`);
                return { interactionType, success: true, userCount: existingTree[1].length, alreadySubmitted: true };
            }

            // Get AI-validated users
            const qualifiedUsers = await this.aiValidator.getQualifiedUsers(day, interactionType);
            
            if (qualifiedUsers.length === 0) {
                console.log(`⚠️  No qualified users for ${typeName}`);
                return { interactionType, success: true, userCount: 0, noUsers: true };
            }

            console.log(`✅ AI validated ${qualifiedUsers.length} users for ${typeName}`);

            // Build Merkle tree
            const users = qualifiedUsers.map(u => u.user);
            const amounts = qualifiedUsers.map(u => u.qobiAmount);
            const merkleRoot = this.merkleBuilder.buildTree(users, amounts);

            console.log(`🌳 Built Merkle tree with root: ${merkleRoot}`);

            // Create EIP712 signature
            const signature = await this.eip712Signer.signSubmission(
                this.wallet,
                day,
                interactionType,
                merkleRoot,
                users,
                amounts
            );

            console.log(`✍️  Created EIP712 signature`);

            // Submit to blockchain
            const tx = await this.contracts.dailyTree.submitDailyTree(
                day,
                interactionType,
                merkleRoot,
                users,
                amounts,
                signature
            );

            console.log(`📤 Transaction submitted: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`⛓️  Transaction confirmed in block ${receipt.blockNumber}`);

            return {
                interactionType,
                success: true,
                userCount: users.length,
                merkleRoot,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };

        } catch (error) {
            console.error(`❌ Failed to process ${typeName}:`, error.message);
            throw error;
        }
    }

    /**
     * Monitor and auto-process trees
     */
    async startAutoProcessing(intervalMinutes = 60) {
        console.log(`🔄 Starting auto-processing every ${intervalMinutes} minutes`);
        
        // Process immediately
        try {
            await this.processDailyTrees();
        } catch (error) {
            console.error('Initial processing failed:', error.message);
        }

        // Set up interval
        setInterval(async () => {
            try {
                console.log('\n⏰ Auto-processing triggered');
                await this.processDailyTrees();
            } catch (error) {
                console.error('Auto-processing failed:', error.message);
            }
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Get processing status
     */
    async getStatus() {
        try {
            const currentDay = await this.contracts.dailyTree.getCurrentDay();
            const hasPermission = await this.checkPermissions();
            const aiConnected = await this.aiValidator.testConnection();
            
            const treeStatus = [];
            for (let interactionType = 0; interactionType < 6; interactionType++) {
                const tree = await this.contracts.dailyTree.getDailyTree(currentDay, interactionType);
                treeStatus.push({
                    type: this.aiValidator.interactionTypes[interactionType],
                    submitted: tree[3],
                    userCount: tree[1].length,
                    merkleRoot: tree[0]
                });
            }

            return {
                currentDay: currentDay.toString(),
                relayerAddress: this.wallet.address,
                hasPermission,
                aiConnected,
                trees: treeStatus
            };
        } catch (error) {
            console.error('Status check failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { RelayerService };
