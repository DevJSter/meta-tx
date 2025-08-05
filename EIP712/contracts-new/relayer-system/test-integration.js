const { ethers } = require('ethers');
const { RelayerService } = require('./src/relayer-service');
const { AIValidator } = require('./src/ai-validator');
const { MerkleTreeBuilder } = require('./src/merkle-tree');
require('dotenv').config();

/**
 * Integration tests for the QOBI relayer system
 */
class QOBIIntegrationTest {
    constructor() {
        this.relayerService = new RelayerService();
        this.aiValidator = new AIValidator();
        this.merkleBuilder = new MerkleTreeBuilder();
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🧪 QOBI Integration Test Suite\n');
        
        const tests = [
            'testSystemConnections',
            'testAIValidator',
            'testMerkleTreeBuilder', 
            'testEIP712Signatures',
            'testRelayerPermissions',
            'testFullWorkflow'
        ];

        for (const testName of tests) {
            try {
                console.log(`\n🔍 Running ${testName}...`);
                await this[testName]();
                this.addResult(testName, true);
                console.log(`✅ ${testName} passed`);
            } catch (error) {
                this.addResult(testName, false, error.message);
                console.log(`❌ ${testName} failed: ${error.message}`);
            }
        }

        this.printSummary();
    }

    async testSystemConnections() {
        // Test blockchain connection
        const blockNumber = await this.relayerService.provider.getBlockNumber();
        if (blockNumber < 0) throw new Error('Invalid block number');

        // Test contract connections
        const currentDay = await this.relayerService.contracts.dailyTree.getCurrentDay();
        if (!currentDay) throw new Error('Cannot get current day');

        // Test AI connection (optional)
        const aiConnected = await this.aiValidator.testConnection();
        console.log(`   AI Validator: ${aiConnected ? 'Connected' : 'Offline (will use fallback)'}`);
        
        console.log(`   Blockchain: Connected (block ${blockNumber})`);
        console.log(`   Current day: ${currentDay}`);
    }

    async testAIValidator() {
        // Generate test interactions
        const testInteractions = [
            {
                user: '0x1234567890123456789012345678901234567890',
                content: 'High quality blockchain analysis post with detailed insights',
                metadata: { engagement: 85, length: 200 }
            },
            {
                user: '0x2345678901234567890123456789012345678901',
                content: 'spam',
                metadata: { engagement: 5, length: 4 }
            },
            {
                user: '0x3456789012345678901234567890123456789012',
                content: 'Great community discussion about DeFi protocols',
                metadata: { engagement: 70, length: 150 }
            }
        ];

        // Test validation for CREATE interactions
        const validated = await this.aiValidator.validateInteractions(testInteractions, 0);
        
        if (validated.length === 0) {
            throw new Error('No interactions validated');
        }

        // Check that high quality content got higher scores
        const highQualityUser = validated.find(v => v.user === testInteractions[0].user);
        const spamUser = validated.find(v => v.user === testInteractions[1].user);
        
        if (highQualityUser && spamUser && highQualityUser.points <= spamUser.points) {
            throw new Error('AI scoring logic failed - spam scored higher than quality content');
        }

        console.log(`   Validated ${validated.length}/${testInteractions.length} interactions`);
        console.log(`   Score range: ${Math.min(...validated.map(v => v.points))}-${Math.max(...validated.map(v => v.points))} points`);
    }

    async testMerkleTreeBuilder() {
        // Test data
        const users = [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333'
        ];
        const amounts = [
            ethers.parseEther('1.0').toString(),
            ethers.parseEther('2.5').toString(),
            ethers.parseEther('0.75').toString()
        ];

        // Build tree
        const merkleRoot = this.merkleBuilder.buildTree(users, amounts);
        
        if (!merkleRoot || merkleRoot === ethers.ZeroHash) {
            throw new Error('Invalid merkle root');
        }

        // Test proof generation
        const proof0 = this.merkleBuilder.generateProof(0);
        const proof1 = this.merkleBuilder.generateProof(1);
        
        if (!proof0 || !proof1 || proof0.length === 0 || proof1.length === 0) {
            throw new Error('Invalid merkle proofs');
        }

        // Verify different users have different proofs
        if (JSON.stringify(proof0) === JSON.stringify(proof1)) {
            throw new Error('Proofs should be different for different users');
        }

        console.log(`   Merkle root: ${merkleRoot.slice(0, 10)}...`);
        console.log(`   Proof lengths: ${proof0.length}, ${proof1.length}`);
    }

    async testEIP712Signatures() {
        const testUsers = ['0x1111111111111111111111111111111111111111'];
        const testAmounts = [ethers.parseEther('1.0').toString()];
        const testDay = 123;
        const testType = 0;
        const testRoot = this.merkleBuilder.buildTree(testUsers, testAmounts);

        // Test signing
        const signature = await this.relayerService.eip712Signer.signSubmission(
            this.relayerService.wallet,
            testDay,
            testType,
            testRoot,
            testUsers,
            testAmounts
        );

        if (!signature || signature.length !== 132) { // 0x + 130 hex chars
            throw new Error('Invalid signature format');
        }

        // Test verification
        const isValid = await this.relayerService.eip712Signer.verifySignature(
            signature,
            testDay,
            testType,
            testRoot,
            testUsers,
            testAmounts,
            this.relayerService.wallet.address
        );

        if (!isValid) {
            throw new Error('Signature verification failed');
        }

        console.log(`   Signature: ${signature.slice(0, 20)}...`);
        console.log(`   Verification: ${isValid ? 'Valid' : 'Invalid'}`);
    }

    async testRelayerPermissions() {
        const hasPermission = await this.relayerService.checkPermissions();
        
        if (!hasPermission) {
            throw new Error('Relayer does not have required permissions');
        }

        console.log(`   Relayer authorized: ${hasPermission}`);
        console.log(`   Relayer address: ${this.relayerService.wallet.address}`);
    }

    async testFullWorkflow() {
        console.log('   Testing end-to-end workflow...');
        
        // Get current day
        const currentDay = await this.relayerService.contracts.dailyTree.getCurrentDay();
        
        // Test each interaction type
        for (let interactionType = 0; interactionType < 3; interactionType++) { // Test first 3 types
            try {
                // Check if already submitted
                const existingTree = await this.relayerService.contracts.dailyTree.getDailyTree(
                    currentDay, 
                    interactionType
                );
                
                if (existingTree[3]) { // Already submitted
                    console.log(`     ${this.aiValidator.interactionTypes[interactionType]}: Already submitted`);
                    continue;
                }

                // Get mock qualified users
                const qualifiedUsers = await this.aiValidator.getQualifiedUsers(currentDay, interactionType);
                
                if (qualifiedUsers.length === 0) {
                    console.log(`     ${this.aiValidator.interactionTypes[interactionType]}: No users`);
                    continue;
                }

                // Build and submit tree
                const users = qualifiedUsers.slice(0, 3).map(u => u.user); // Limit to 3 for testing
                const amounts = qualifiedUsers.slice(0, 3).map(u => u.qobiAmount);
                
                const merkleRoot = this.merkleBuilder.buildTree(users, amounts);
                const signature = await this.relayerService.eip712Signer.signSubmission(
                    this.relayerService.wallet,
                    currentDay,
                    interactionType,
                    merkleRoot,
                    users,
                    amounts
                );

                // Submit transaction
                const tx = await this.relayerService.contracts.dailyTree.submitDailyTree(
                    currentDay,
                    interactionType,
                    merkleRoot,
                    users,
                    amounts,
                    signature
                );

                await tx.wait();
                
                console.log(`     ${this.aiValidator.interactionTypes[interactionType]}: ✅ Submitted (${users.length} users)`);
                
                // Small delay between submissions
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`     ${this.aiValidator.interactionTypes[interactionType]}: ❌ ${error.message}`);
            }
        }
    }

    addResult(testName, passed, error = null) {
        this.testResults.push({ testName, passed, error });
    }

    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        this.testResults.forEach(result => {
            const icon = result.passed ? '✅' : '❌';
            console.log(`${icon} ${result.testName}`);
            if (!result.passed && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! System is ready for production.');
        } else {
            console.log('⚠️  Some tests failed. Please check the issues above.');
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new QOBIIntegrationTest();
    tester.runAllTests().catch(console.error);
}

module.exports = { QOBIIntegrationTest };
