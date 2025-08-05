#!/usr/bin/env node

const { RelayerService } = require('./src/relayer-service');
const { AIValidator } = require('./src/ai-validator');

/**
 * CLI interface for QOBI relayer system
 */
class RelayerCLI {
    constructor() {
        this.relayerService = new RelayerService();
        this.aiValidator = new AIValidator();
    }

    async run() {
        const args = process.argv.slice(2);
        const command = args[0];

        try {
            switch (command) {
                case 'status':
                    await this.showStatus();
                    break;
                case 'process':
                    await this.processTrees();
                    break;
                case 'auto':
                    await this.startAutoMode(parseInt(args[1]) || 60);
                    break;
                case 'test-ai':
                    await this.testAI();
                    break;
                case 'validate':
                    await this.validateDemo(parseInt(args[1]) || 0);
                    break;
                case 'trees':
                    await this.showTrees(parseInt(args[1]));
                    break;
                case 'help':
                default:
                    this.showHelp();
                    break;
            }
        } catch (error) {
            console.error('❌ Command failed:', error.message);
            process.exit(1);
        }
    }

    async showStatus() {
        console.log('📊 QOBI Relayer System Status\n');
        
        const status = await this.relayerService.getStatus();
        
        console.log('🔗 System Information:');
        console.log(`   Current Day: ${status.currentDay}`);
        console.log(`   Relayer: ${status.relayerAddress}`);
        console.log(`   Authorized: ${status.hasPermission ? '✅' : '❌'}`);
        console.log(`   AI Connected: ${status.aiConnected ? '✅' : '❌'}`);
        
        console.log('\n🌳 Daily Trees:');
        status.trees.forEach(tree => {
            const icon = tree.submitted ? '✅' : '⏳';
            console.log(`   ${icon} ${tree.type}: ${tree.userCount} users`);
        });
    }

    async processTrees() {
        console.log('🔄 Processing daily trees...\n');
        
        const results = await this.relayerService.processDailyTrees();
        
        console.log('\n📊 Processing Results:');
        let totalUsers = 0;
        let successCount = 0;
        
        results.forEach(result => {
            const typeName = this.aiValidator.interactionTypes[result.interactionType];
            const icon = result.success ? '✅' : '❌';
            console.log(`   ${icon} ${typeName}: ${result.userCount || 0} users`);
            
            if (result.success) {
                successCount++;
                totalUsers += result.userCount || 0;
            }
        });
        
        console.log(`\n📈 Summary: ${successCount}/6 trees submitted, ${totalUsers} total users`);
    }

    async startAutoMode(intervalMinutes) {
        console.log(`🤖 Starting auto-processing mode (${intervalMinutes} minute intervals)`);
        console.log('Press Ctrl+C to stop\n');
        
        await this.relayerService.startAutoProcessing(intervalMinutes);
        
        // Keep process alive
        process.on('SIGINT', () => {
            console.log('\n👋 Auto-processing stopped');
            process.exit(0);
        });
    }

    async testAI() {
        console.log('🤖 Testing AI Validator...\n');
        
        const connected = await this.aiValidator.testConnection();
        
        if (connected) {
            console.log('✅ AI validator is working!');
            console.log(`   Model: ${this.aiValidator.model}`);
            console.log(`   URL: ${this.aiValidator.ollamaUrl}`);
        } else {
            console.log('❌ AI validator not available');
            console.log('   Make sure Ollama is running: ollama serve');
        }
    }

    async validateDemo(interactionType) {
        const typeName = this.aiValidator.interactionTypes[interactionType];
        console.log(`🤖 Demo validation for ${typeName} interactions...\n`);
        
        // Generate mock interactions
        const mockInteractions = [];
        for (let i = 0; i < 15; i++) {
            mockInteractions.push({
                user: `0x${Math.random().toString(16).substr(2, 40)}`,
                content: `Mock ${typeName.toLowerCase()} interaction ${i + 1}`,
                metadata: { engagement: Math.floor(Math.random() * 100) }
            });
        }

        console.log(`📝 Generated ${mockInteractions.length} mock interactions`);
        
        const validated = await this.aiValidator.validateInteractions(mockInteractions, interactionType);
        
        console.log(`✅ AI validated ${validated.length} interactions:\n`);
        
        validated.forEach((user, i) => {
            const qobiEth = (parseFloat(user.qobiAmount) / 1e18).toFixed(4);
            console.log(`   ${i + 1}. ${user.user.slice(0, 8)}... | ${user.points} pts | ${qobiEth} QOBI`);
        });
        
        const totalQOBI = validated.reduce((sum, user) => 
            sum + parseFloat(user.qobiAmount), 0) / 1e18;
        console.log(`\n💰 Total QOBI allocated: ${totalQOBI.toFixed(4)}`);
    }

    async showTrees(day) {
        if (!day) {
            const status = await this.relayerService.getStatus();
            day = parseInt(status.currentDay);
        }
        
        console.log(`🌳 Daily Trees for Day ${day}\n`);
        
        for (let interactionType = 0; interactionType < 6; interactionType++) {
            const typeName = this.aiValidator.interactionTypes[interactionType];
            
            try {
                const tree = await this.relayerService.contracts.dailyTree.getDailyTree(day, interactionType);
                const [merkleRoot, users, amounts, isSubmitted] = tree;
                
                console.log(`${isSubmitted ? '✅' : '⏳'} ${typeName}:`);
                console.log(`   Users: ${users.length}`);
                console.log(`   Root: ${merkleRoot.slice(0, 10)}...`);
                
                if (users.length > 0) {
                    const totalQOBI = amounts.reduce((sum, amount) => 
                        sum + parseFloat(amount.toString()), 0) / 1e18;
                    console.log(`   Total QOBI: ${totalQOBI.toFixed(4)}`);
                }
                console.log();
            } catch (error) {
                console.log(`❌ ${typeName}: Error - ${error.message}\n`);
            }
        }
    }

    showHelp() {
        console.log(`
🚀 QOBI Relayer CLI

USAGE:
    node cli.js <command> [options]

COMMANDS:
    status              Show system status
    process             Process daily trees manually
    auto [minutes]      Start auto-processing (default: 60 min)
    test-ai             Test AI validator connection
    validate [type]     Demo AI validation (type: 0-5)
    trees [day]         Show trees for day (default: current)
    help                Show this help message

EXAMPLES:
    node cli.js status
    node cli.js process
    node cli.js auto 30
    node cli.js validate 0
    node cli.js trees 123

SETUP:
    1. Make sure Anvil is running: anvil
    2. Start Ollama: ollama serve
    3. Install Ollama model: ollama pull llama3.2:3b
    4. Check .env file has correct addresses
        `);
    }
}

// Run CLI if called directly
if (require.main === module) {
    const cli = new RelayerCLI();
    cli.run().catch(console.error);
}

module.exports = { RelayerCLI };
