#!/usr/bin/env node
require('dotenv').config();
const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const RelayerService = require('./src/relayer-service');
const { ethers } = require('ethers');

const program = new Command();

program
  .name('qobi-cli')
  .description('QOBI Relayer System Command Line Interface')
  .version('1.0.0');

// Global relayer service instance
let relayerService;

// Initialize service
async function initService() {
  if (!relayerService) {
    relayerService = new RelayerService();
    await relayerService.initialize();
  }
  return relayerService;
}

// Submit transaction command
program
  .command('submit')
  .description('Submit a transaction for processing')
  .option('-f, --from <address>', 'From address')
  .option('-t, --to <address>', 'To address')
  .option('-v, --value <amount>', 'Value in ETH', '0')
  .option('-d, --data <data>', 'Transaction data', '0x')
  .action(async (options) => {
    try {
      const service = await initService();
      
      let { from, to, value, data } = options;
      
      // Interactive prompts if not provided
      if (!from || !to) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'from',
            message: 'From address:',
            when: !from,
            validate: (input) => ethers.isAddress(input) || 'Invalid address'
          },
          {
            type: 'input',
            name: 'to',
            message: 'To address:',
            when: !to,
            validate: (input) => ethers.isAddress(input) || 'Invalid address'
          },
          {
            type: 'input',
            name: 'value',
            message: 'Value (ETH):',
            default: '0',
            when: !value
          },
          {
            type: 'input',
            name: 'data',
            message: 'Transaction data:',
            default: '0x',
            when: !data
          }
        ]);
        
        from = from || answers.from;
        to = to || answers.to;
        value = value || answers.value;
        data = data || answers.data;
      }

      const txId = await service.addTransaction({ from, to, value, data });
      
      console.log(chalk.green('✅ Transaction submitted successfully!'));
      console.log(chalk.blue(`📝 Transaction ID: ${txId}`));
      console.log(chalk.yellow('⏳ Transaction is now queued for AI validation...'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// Status command
program
  .command('status')
  .description('Show relayer service status')
  .action(async () => {
    try {
      const service = await initService();
      const stats = service.getStats();
      
      console.log(chalk.blue.bold('\n📊 QOBI Relayer Status\n'));
      console.log(chalk.green(`✅ Service: Running`));
      console.log(chalk.blue(`📋 Pending Transactions: ${stats.pendingTransactions}`));
      console.log(chalk.blue(`🔄 Processed Batches: ${stats.processedBatches}`));
      console.log(chalk.blue(`✅ Total Validated: ${stats.totalValidated}`));
      console.log(chalk.blue(`🚀 Total Relayed: ${stats.totalRelayed}`));
      console.log(chalk.blue(`⚡ Avg Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`));
      console.log(chalk.red(`❌ Errors: ${stats.errorCount}`));
      
      if (stats.merkleTreeStats) {
        console.log(chalk.yellow(`\n🌳 Merkle Tree:`));
        console.log(chalk.yellow(`   Leaves: ${stats.merkleTreeStats.leafCount}`));
        console.log(chalk.yellow(`   Depth: ${stats.merkleTreeStats.depth}`));
        console.log(chalk.yellow(`   Root: ${stats.merkleTreeStats.root}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// Relay command
program
  .command('relay <transactionId>')
  .description('Relay a validated transaction to the blockchain')
  .action(async (transactionId) => {
    try {
      const service = await initService();
      
      console.log(chalk.yellow(`🚀 Relaying transaction ${transactionId}...`));
      
      const result = await service.relayTransaction(transactionId);
      
      console.log(chalk.green('✅ Transaction relayed successfully!'));
      console.log(chalk.blue(`🔗 TX Hash: ${result.txHash}`));
      console.log(chalk.blue(`✍️ Signature: ${result.signature.slice(0, 20)}...`));
      console.log(chalk.blue(`🌳 Merkle Proof: ${result.merkleProof.length} nodes`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// Batches command
program
  .command('batches')
  .description('Show recent processed batches')
  .option('-c, --count <number>', 'Number of batches to show', '5')
  .action(async (options) => {
    try {
      const service = await initService();
      const count = parseInt(options.count);
      const batches = service.getRecentBatches(count);
      
      console.log(chalk.blue.bold(`\n📦 Recent ${count} Batches\n`));
      
      if (batches.length === 0) {
        console.log(chalk.yellow('No batches processed yet.'));
        return;
      }
      
      batches.forEach((batch, index) => {
        console.log(chalk.cyan(`${index + 1}. Batch: ${batch.id}`));
        console.log(`   📅 Processed: ${batch.processedAt}`);
        console.log(`   📊 Transactions: ${batch.stats.total} (${batch.stats.validated} validated, ${batch.stats.rejected} rejected)`);
        console.log(`   ⏱️ Processing Time: ${batch.processingTime}ms`);
        console.log(`   🌳 Merkle Root: ${batch.merkleRoot}`);
        console.log('');
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// AI status command
program
  .command('ai-status')
  .description('Check AI validator status')
  .action(async () => {
    try {
      const service = await initService();
      const connection = await service.aiValidator.testConnection();
      const stats = service.aiValidator.getValidationStats();
      
      console.log(chalk.blue.bold('\n🤖 AI Validator Status\n'));
      
      if (connection.connected) {
        console.log(chalk.green('✅ Connection: OK'));
        console.log(chalk.blue(`🔗 URL: ${service.config.ollamaUrl}`));
        console.log(chalk.blue(`🧠 Model: ${connection.currentModel}`));
        console.log(chalk.blue(`📋 Available Models: ${connection.availableModels.length}`));
      } else {
        console.log(chalk.red('❌ Connection: Failed'));
        console.log(chalk.red(`Error: ${connection.error}`));
      }
      
      if (stats.totalValidations) {
        console.log(chalk.yellow(`\n📊 Validation Stats:`));
        console.log(chalk.yellow(`   Total: ${stats.totalValidations}`));
        console.log(chalk.yellow(`   Avg Risk Score: ${stats.averageRiskScore.toFixed(2)}`));
        console.log(chalk.yellow(`   Avg Confidence: ${stats.averageConfidence.toFixed(2)}`));
        console.log(chalk.yellow(`   Classifications: ${JSON.stringify(stats.classifications)}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    try {
      const service = await initService();
      
      console.log(chalk.blue.bold('\n🚀 QOBI Interactive Mode\n'));
      
      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              'Submit Transaction',
              'View Status',
              'View Recent Batches',
              'Check AI Status',
              'Exit'
            ]
          }
        ]);
        
        switch (action) {
          case 'Submit Transaction':
            await submitInteractive(service);
            break;
          case 'View Status':
            await showStatus(service);
            break;
          case 'View Recent Batches':
            await showBatches(service);
            break;
          case 'Check AI Status':
            await showAIStatus(service);
            break;
          case 'Exit':
            console.log(chalk.green('👋 Goodbye!'));
            return;
        }
        
        console.log(''); // Add spacing
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

// Interactive helper functions
async function submitInteractive(service) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'from',
      message: 'From address:',
      validate: (input) => ethers.isAddress(input) || 'Invalid address'
    },
    {
      type: 'input',
      name: 'to',
      message: 'To address:',
      validate: (input) => ethers.isAddress(input) || 'Invalid address'
    },
    {
      type: 'input',
      name: 'value',
      message: 'Value (ETH):',
      default: '0'
    }
  ]);
  
  const txId = await service.addTransaction(answers);
  console.log(chalk.green(`✅ Transaction ${txId} submitted!`));
}

async function showStatus(service) {
  const stats = service.getStats();
  console.log(chalk.blue(`📋 Pending: ${stats.pendingTransactions} | Processed: ${stats.totalProcessed} | Relayed: ${stats.totalRelayed}`));
}

async function showBatches(service) {
  const batches = service.getRecentBatches(3);
  console.log(chalk.cyan(`📦 Recent ${batches.length} batches processed`));
}

async function showAIStatus(service) {
  const connection = await service.aiValidator.testConnection();
  const status = connection.connected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected');
  console.log(`🤖 AI Validator: ${status}`);
}

// Demo command
program
  .command('demo')
  .description('Run a demo with sample transactions')
  .option('-c, --count <number>', 'Number of demo transactions', '5')
  .action(async (options) => {
    try {
      const service = await initService();
      const count = parseInt(options.count);
      
      console.log(chalk.blue.bold(`\n🎯 Running demo with ${count} transactions\n`));
      
      const demoTransactions = [];
      for (let i = 0; i < count; i++) {
        const tx = {
          from: ethers.Wallet.createRandom().address,
          to: ethers.Wallet.createRandom().address,
          value: (Math.random() * 0.1).toFixed(4),
          data: '0x'
        };
        
        const txId = await service.addTransaction(tx);
        demoTransactions.push({ id: txId, ...tx });
        
        console.log(chalk.green(`✅ ${i + 1}/${count} Demo transaction ${txId} submitted`));
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(chalk.blue('\n⏳ Waiting for batch processing...'));
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const stats = service.getStats();
      console.log(chalk.green(`\n🎉 Demo complete! Check status for results.`));
      console.log(chalk.blue(`📊 Current stats: ${stats.totalValidated} validated, ${stats.totalRelayed} relayed`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  });

program.parse();
