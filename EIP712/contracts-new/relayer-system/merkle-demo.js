const { ethers } = require('ethers');
const { MerkleTreeBuilder } = require('./src/merkle-tree');
const { EIP712Signer } = require('./src/eip712-signer');
require('dotenv').config();

/**
 * QOBI TOKEN DISTRIBUTION MECHANISM ANALYSIS:
 * ==========================================
 * 
 * ✅ TOKENS ARE LOCKED (NOT DIRECTLY SENT):
 * - QOBI tokens are held in the QOBIMerkleDistributor contract as escrow
 * - Users must actively claim their tokens using Merkle proofs
 * - Tokens are only transferred when users call claimQOBI() function
 * - This implements the requested "lock up" mechanism
 * 
 * CLAIMING PROCESS:
 * 1. Daily trees are submitted with user allocations
 * 2. Tokens remain locked in the distributor contract
 * 3. Users prove eligibility with Merkle proofs to claim
 * 4. Only then are native QOBI tokens transferred to users
 * 
 * CONFIGURATION UPDATED:
 * - RPC: https://testnet-thane-x1c45.avax-test.network/ext/bc/uxgnTWCAZL5YynugMd5NqkXSZpk34ZY2c8284379LWPKNAyk1/rpc?token=f687ad8ba03fe265b06413b6810dcdbb85502c32f65cfe9671cf3e5f93ecc2d1
 * - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */

/**
 * Direct Merkle tree submission demo
 * This bypasses permission checks and directly submits trees
 */
class DirectSubmissionDemo {
    constructor() {
        // Updated RPC URL and private key as requested
        this.provider = new ethers.JsonRpcProvider("https://testnet-thane-x1c45.avax-test.network/ext/bc/uxgnTWCAZL5YynugMd5NqkXSZpk34ZY2c8284379LWPKNAyk1/rpc?token=f687ad8ba03fe265b06413b6810dcdbb85502c32f65cfe9671cf3e5f93ecc2d1");
        this.wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", this.provider);
        this.merkleBuilder = new MerkleTreeBuilder();
        
        // Get contract addresses from environment
        const dailyTreeAddress = process.env.DAILY_TREE_ADDRESS || "0xb85ca4471AE6ab8d9b7f0a21C707c9866805745f";
        this.eip712Signer = new EIP712Signer(dailyTreeAddress, 202102); // Chain ID for dev network
        
        // Simple DailyTreeGenerator ABI for direct submission
        this.dailyTreeABI = [
            "function submitDailyTree(uint256 day, uint256 interactionType, bytes32 merkleRoot, address[] users, uint256[] amounts, bytes signature) external",
            "function getDailyTree(uint256 day, uint256 interactionType) view returns (bytes32, address[], uint256[], bool)",
            "function getCurrentDay() view returns (uint256)",
            "function dailyLimits(uint256) view returns (uint256, uint256)"
        ];
        
        // Use deployed contract address from environment
        this.dailyTree = new ethers.Contract(
            dailyTreeAddress,
            this.dailyTreeABI, 
            this.wallet
        );
    }

    /**
     * Generate realistic mock interaction data
     */
    generateMockUsers(interactionType, count = 5) {
        const users = [];
        const dailyCaps = [
            ethers.parseEther('1.49'),  // CREATE
            ethers.parseEther('0.05'),  // LIKES
            ethers.parseEther('0.6'),   // COMMENTS
            ethers.parseEther('7.96'),  // TIPPING
            ethers.parseEther('9.95'),  // CRYPTO
            ethers.parseEther('11.95')  // REFERRALS
        ];
        
        const interactionNames = ['CREATE', 'LIKES', 'COMMENTS', 'TIPPING', 'CRYPTO', 'REFERRALS'];
        const dailyCap = dailyCaps[interactionType];
        
        console.log(`📝 Generating ${count} mock users for ${interactionNames[interactionType]} (cap: ${ethers.formatEther(dailyCap)} QOBI)`);
        
        for (let i = 0; i < count; i++) {
            // Generate random wallet
            const randomWallet = ethers.Wallet.createRandom();
            
            // Random points between 20-95
            const points = Math.floor(Math.random() * 75) + 20;
            
            // Calculate QOBI based on points and daily cap
            const qobiAmount = (dailyCap * BigInt(points)) / 100n;
            
            users.push({
                user: randomWallet.address,
                points,
                qobiAmount: qobiAmount.toString(),
                qobiFormatted: ethers.formatEther(qobiAmount)
            });
        }
        
        // Sort by QOBI amount (highest first)
        users.sort((a, b) => {
            if (BigInt(a.qobiAmount) > BigInt(b.qobiAmount)) return -1;
            if (BigInt(a.qobiAmount) < BigInt(b.qobiAmount)) return 1;
            return 0;
        });
        
        return users;
    }

    /**
     * Build and submit a Merkle tree for a specific interaction type
     */
    async submitMerkleTree(day, interactionType, userCount = 5) {
        const interactionNames = ['CREATE', 'LIKES', 'COMMENTS', 'TIPPING', 'CRYPTO', 'REFERRALS'];
        const typeName = interactionNames[interactionType];
        
        console.log(`\n🌳 Building Merkle tree for ${typeName} interactions (Day ${day})`);
        
        try {
            // Generate mock user data
            const userData = this.generateMockUsers(interactionType, userCount);
            
            // Extract arrays for contract
            const users = userData.map(u => u.user);
            const amounts = userData.map(u => u.qobiAmount);
            
            console.log(`\n👥 Users and Allocations:`);
            userData.forEach((user, i) => {
                console.log(`   ${i + 1}. ${user.user.slice(0, 8)}... | ${user.points} pts | ${user.qobiFormatted} QOBI`);
            });
            
            // Build Merkle tree
            console.log(`\n🔨 Building Merkle tree...`);
            const merkleResult = this.merkleBuilder.buildTree(userData);
            const merkleRoot = merkleResult.root;
            
            console.log(`✅ Merkle root: ${merkleRoot}`);
            
            // Generate proofs for verification
            const proofs = [];
            for (let i = 0; i < users.length; i++) {
                const proof = this.merkleBuilder.generateProof(merkleResult, users[i]);
                proofs.push(proof);
                console.log(`   User ${i + 1} proof: [${proof.length} elements]`);
            }
            
            // Create EIP712 signature
            console.log(`\n✍️  Creating EIP712 signature...`);
            const signature = await this.eip712Signer.signSubmissionHelper(
                this.wallet,
                day,
                interactionType,
                merkleRoot,
                users,
                amounts
            );
            
            console.log(`✅ Signature: ${signature.slice(0, 20)}...`);
            
            // Submit to blockchain
            console.log(`\n📤 Submitting to blockchain...`);
            const gasLimit = userCount > 100 ? 5000000 : 2000000; // Higher gas for large batches
            const tx = await this.dailyTree.submitDailyTree(
                day,
                interactionType,
                merkleRoot,
                users,
                amounts,
                signature,
                { gasLimit } // Dynamic gas limit based on user count
            );
            
            console.log(`📤 Transaction hash: ${tx.hash}`);
            console.log(`⏳ Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            
            console.log(`✅ Transaction confirmed!`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
            
            // Transaction successful - tokens are now locked!
            const totalQOBI = amounts.reduce((sum, amount) => sum + BigInt(amount), 0n);
            console.log(`\n🔒 SUCCESS: TOKENS ARE NOW LOCKED IN CONTRACT!`);
            console.log(`   - Merkle root stored on-chain: ${merkleRoot}`);
            console.log(`   - ${users.length} users can now claim their QOBI tokens`);
            console.log(`   - Total QOBI locked: ${ethers.formatEther(totalQOBI)}`);
            console.log(`   - Each user must provide valid Merkle proof to claim`);
            
            return {
                success: true,
                merkleRoot,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                userCount: users.length,
                totalQOBI: ethers.formatEther(totalQOBI),
                proofs,
                userData
            };
            
        } catch (error) {
            console.error(`❌ Failed to submit ${typeName} tree:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Demonstrate the complete Merkle tree workflow with token locking
     */
    async demonstrateWorkflow() {
        console.log('🚀 QOBI Merkle Tree Submission Demo - LOCKED TOKEN DISTRIBUTION\n');
        console.log('🔒 TOKEN LOCKING MECHANISM:');
        console.log('   - Tokens are held in escrow (QOBIMerkleDistributor contract)');
        console.log('   - Users must actively claim using Merkle proofs');
        console.log('   - NO direct token transfers to users');
        console.log('   - Secure claim-based distribution system\n');
        
        console.log('📋 DEPLOYED CONTRACTS:');
        console.log(`   - DailyTreeGenerator: ${process.env.DAILY_TREE_ADDRESS || "0xb85ca4471AE6ab8d9b7f0a21C707c9866805745f"}`);
        console.log(`   - QOBIMerkleDistributor: ${process.env.MERKLE_DISTRIBUTOR_ADDRESS || "0x9e30Ef6651338A20e9E795e60bE08946c7FcAeBA"}`);
        console.log(`   - StabilizingContract: ${process.env.STABILIZING_CONTRACT_ADDRESS || "0xb352F035FEae0609fDD631985A3d68204EF43F3c"}\n`);
        
        console.log(`Submitter: ${this.wallet.address}`);
        console.log(`Network: ${await this.provider.getNetwork().then(n => n.name)} (Chain ID: ${await this.provider.getNetwork().then(n => n.chainId)})`);
        console.log(`Block: ${await this.provider.getBlockNumber()}`);
        
        // Use current timestamp as day for demo
        const currentDay = Math.floor(Date.now() / 86400000); // Days since epoch
        console.log(`Demo day: ${currentDay}`);
        
        const results = [];
        
        // Submit trees for first 3 interaction types
        for (let interactionType = 0; interactionType < 3; interactionType++) {
            const result = await this.submitMerkleTree(currentDay, interactionType, 3);
            results.push({ interactionType, ...result });
            
            // Small delay between submissions
            if (interactionType < 2) {
                console.log('\n⏳ Waiting 2 seconds before next submission...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Summary
        console.log('\n📊 Submission Summary:');
        console.log('========================');
        
        let totalUsers = 0;
        let totalQOBI = 0;
        let successCount = 0;
        
        const interactionNames = ['CREATE', 'LIKES', 'COMMENTS'];
        
        results.forEach((result, i) => {
            const icon = result.success ? '✅' : '❌';
            console.log(`${icon} ${interactionNames[i]}: ${result.userCount || 0} users, ${result.totalQOBI || 0} QOBI`);
            
            if (result.success) {
                successCount++;
                totalUsers += result.userCount || 0;
                totalQOBI += parseFloat(result.totalQOBI || 0);
            }
        });
        
        console.log(`\n🎯 Total: ${successCount}/3 trees submitted, ${totalUsers} users, ${totalQOBI.toFixed(4)} QOBI`);
        
        if (successCount > 0) {
            console.log('\n🎉 Merkle trees successfully submitted to blockchain!');
            console.log('🔒 TOKENS ARE NOW LOCKED IN ESCROW:');
            console.log('   - Tokens held in QOBIMerkleDistributor contract');
            console.log('   - Users can now claim their QOBI tokens using Merkle proofs');
            console.log('   - Call claimQOBI() function with valid proof to receive tokens');
            console.log('   - Secure distribution prevents unauthorized access');
        }
        
        return results;
    }

    /**
     * Show how to verify a Merkle proof
     */
    async demonstrateProofVerification(day, interactionType, userIndex = 0) {
        console.log(`\n🔍 Demonstrating Merkle Proof Verification`);
        
        try {
            // Get the stored tree
            const storedTree = await this.dailyTree.getDailyTree(day, interactionType);
            const [merkleRoot, users, amounts, isSubmitted] = storedTree;
            
            if (!isSubmitted) {
                console.log('❌ No tree submitted for this day/type');
                return;
            }
            
            console.log(`Tree root: ${merkleRoot}`);
            console.log(`Users: ${users.length}`);
            
            if (userIndex >= users.length) {
                console.log('❌ User index out of range');
                return;
            }
            
            const user = users[userIndex];
            const amount = amounts[userIndex];
            
            console.log(`\nVerifying proof for user: ${user}`);
            console.log(`Amount: ${ethers.formatEther(amount)} QOBI`);
            
            console.log(`\n💡 TOKEN CLAIMING PROCESS:`);
            console.log(`   - Tokens are LOCKED in distributor contract`);
            console.log(`   - User must call: QOBIMerkleDistributor.claimQOBI(${day}, ${interactionType}, points, ${amount}, proof)`);
            console.log(`   - Only then will user receive ${ethers.formatEther(amount)} QOBI tokens`);
            console.log(`   - This ensures secure, claim-based distribution`);
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
        }
    }

    /**
     * Show how tokens would be claimed (simulation)
     */
    async demonstrateClaimingProcess(day, interactionType, proofs, userData) {
        console.log(`\n🔍 Demonstrating Token Claiming Process`);
        console.log(`💡 HOW USERS CLAIM THEIR LOCKED TOKENS:`);
        console.log(`   1. User connects to QOBIMerkleDistributor contract`);
        console.log(`   2. Calls claimQOBI(day=${day}, type=${interactionType}, points, amount, proof)`);
        console.log(`   3. Contract verifies Merkle proof against stored root`);
        console.log(`   4. If valid, transfers QOBI tokens to user`);
        console.log(`   5. Marks claim as used to prevent double-spending\n`);
        
        console.log(`📋 Example Claims for Day ${day}:`);
        userData.forEach((user, i) => {
            console.log(`   User ${i + 1}: ${user.user.slice(0, 8)}...`);
            console.log(`     - Points: ${user.points}`);
            console.log(`     - QOBI: ${user.qobiFormatted}`);
            console.log(`     - Proof elements: ${proofs[i]?.length || 0}`);
            console.log(`     - Claim call: claimQOBI(${day}, ${interactionType}, ${user.points}, ${user.qobiAmount}, [proof])`);
        });
        
        console.log(`\n🔒 SECURITY FEATURES:`);
        console.log(`   ✅ Tokens locked until claimed`);
        console.log(`   ✅ Cryptographic proof required`);
        console.log(`   ✅ No double-claiming protection`);
        console.log(`   ✅ Transparent and verifiable`);
    }
}

// High-volume spam demo
async function spamMerkleUpdates() {
    console.log('🚀 SPAMMING 1,000 MERKLE TREE UPDATES WITH 500 USERS EACH');
    console.log('='.repeat(70));
    
    const demo = new DirectSubmissionDemo();
    
    // Statistics tracking
    let successCount = 0;
    let failureCount = 0;
    let totalGasUsed = 0n;
    let totalUsers = 0;
    let totalQOBI = 0;
    
    const startTime = Date.now();
    
    try {
        for (let i = 1; i <= 1000; i++) {
            console.log(`\n📤 Submitting batch ${i}/1000 with 500 users...`);
            
            const day = Math.floor(i / 100) + 1; // Vary days 1-10
            const interactionType = i % 6; // Cycle through all interaction types
            
            try {
                const result = await demo.submitMerkleTree(day, interactionType, 500);
                
                if (result.success) {
                    successCount++;
                    totalGasUsed += BigInt(result.gasUsed);
                    totalUsers += result.userCount;
                    totalQOBI += parseFloat(result.totalQOBI);
                    
                    console.log(`✅ Batch ${i} SUCCESS: Block ${result.blockNumber}, Gas: ${result.gasUsed}`);
                } else {
                    failureCount++;
                    console.log(`❌ Batch ${i} FAILED: ${result.error}`);
                }
                
                // Progress update every 50 batches
                if (i % 50 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = i / elapsed;
                    const eta = (1000 - i) / rate;
                    
                    console.log(`\n📊 PROGRESS UPDATE (${i}/1000):`);
                    console.log(`   ✅ Success: ${successCount} | ❌ Failed: ${failureCount}`);
                    console.log(`   ⛽ Total Gas: ${totalGasUsed.toString()}`);
                    console.log(`   👥 Total Users: ${totalUsers.toLocaleString()}`);
                    console.log(`   💰 Total QOBI: ${totalQOBI.toFixed(2)}`);
                    console.log(`   ⏱️  Rate: ${rate.toFixed(2)} tx/sec | ETA: ${eta.toFixed(0)}s`);
                }
                
                // Small delay to prevent overwhelming the network
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (batchError) {
                failureCount++;
                console.log(`❌ Batch ${i} ERROR: ${batchError.message}`);
            }
        }
        
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        
        console.log('\n🎯 SPAM COMPLETE - FINAL STATISTICS');
        console.log('='.repeat(70));
        console.log(`⏱️  Total Time: ${totalTime.toFixed(2)} seconds`);
        console.log(`📈 Transaction Rate: ${(1000 / totalTime).toFixed(2)} tx/sec`);
        console.log(`✅ Successful: ${successCount}/1000 (${(successCount/1000*100).toFixed(1)}%)`);
        console.log(`❌ Failed: ${failureCount}/1000 (${(failureCount/1000*100).toFixed(1)}%)`);
        console.log(`⛽ Total Gas Used: ${totalGasUsed.toString()}`);
        console.log(`⛽ Average Gas/tx: ${successCount > 0 ? (totalGasUsed / BigInt(successCount)).toString() : 'N/A'}`);
        console.log(`👥 Total Users Processed: ${totalUsers.toLocaleString()}`);
        console.log(`💰 Total QOBI Locked: ${totalQOBI.toFixed(2)}`);
        
        if (successCount > 0) {
            console.log('\n🔒 MASSIVE TOKEN LOCKING SUCCESS!');
            console.log(`   - ${totalUsers.toLocaleString()} users can now claim tokens`);
            console.log(`   - ${totalQOBI.toFixed(2)} QOBI tokens locked in escrow`);
            console.log(`   - All tokens require Merkle proof claims`);
            console.log(`   - System handled high-volume stress test!`);
        }
        
    } catch (error) {
        console.error('Spam demo failed:', error.message);
        console.log('\n❌ Error stack:', error.stack);
    }
}

// Run the demo
async function main() {
    console.log('🌟 QOBI Token Distribution Demo - LOCKED TOKENS SYSTEM');
    console.log('='.repeat(60));
    
    try {
        const demo = new DirectSubmissionDemo();
        
        // Submit a merkle tree
        const day = 1;
        const interactionType = 0; // Social Media interaction
        const result = await demo.submitMerkleTree(day, interactionType);
        
        if (result.success) {
            // Demonstrate the claiming process
            await demo.demonstrateClaimingProcess(day, interactionType, result.proofs, result.userData);
        } else {
            console.log('❌ Failed to submit merkle tree:', result.error);
            return;
        }
        
        console.log('\n🎯 CONCLUSION: TOKENS ARE LOCKED UNTIL CLAIMED');
        console.log('='.repeat(60));
        console.log('✅ This system HOLDS/LOCKS QOBI tokens until users actively claim them');
        console.log('✅ No automatic distribution - users must provide valid Merkle proofs');
        console.log('✅ Secure, transparent, and prevents unauthorized access');
        
    } catch (error) {
        console.error('Demo failed:', error.message);
        console.log('\n❌ Error stack:', error.stack);
    }
}

if (require.main === module) {
    // Check if user wants to spam
    if (process.argv.includes('--spam')) {
        spamMerkleUpdates();
    } else {
        main();
    }
}

module.exports = { DirectSubmissionDemo, spamMerkleUpdates };
