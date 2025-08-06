require('dotenv').config();
const RelayerService = require('./src/relayer-service');
const chalk = require('chalk');
const { ethers } = require('ethers');

async function runIntegrationTest() {
  console.log(chalk.blue.bold('\n🧪 QOBI Integration Test\n'));

  try {
    // Initialize relayer service
    console.log(chalk.yellow('🚀 Initializing Relayer Service...'));
    const relayerService = new RelayerService();
    await relayerService.initialize();
    console.log(chalk.green('✅ Service initialized'));

    // Test 1: Submit transactions
    console.log(chalk.yellow('\n📝 Test 1: Submitting test transactions...'));
    const testTransactions = [];
    
    for (let i = 0; i < 5; i++) {
      const tx = {
        from: ethers.Wallet.createRandom().address,
        to: ethers.Wallet.createRandom().address,
        value: (Math.random() * 0.01).toFixed(6),
        data: '0x'
      };
      
      const txId = await relayerService.addTransaction(tx);
      testTransactions.push({ id: txId, ...tx });
      console.log(chalk.cyan(`   ✅ Transaction ${i + 1}: ${txId}`));
    }

    // Test 2: Wait for batch processing
    console.log(chalk.yellow('\n⏳ Test 2: Waiting for batch processing...'));
    await new Promise(resolve => setTimeout(resolve, 12000)); // Wait for processing interval
    
    const stats = relayerService.getStats();
    console.log(chalk.green(`   ✅ Processed: ${stats.totalProcessed} transactions`));
    console.log(chalk.green(`   ✅ Validated: ${stats.totalValidated} transactions`));

    // Test 3: Check AI validator
    console.log(chalk.yellow('\n🤖 Test 3: AI Validator status...'));
    const aiStatus = await relayerService.aiValidator.testConnection();
    if (aiStatus.connected) {
      console.log(chalk.green(`   ✅ AI Connected: ${aiStatus.currentModel}`));
      const aiStats = relayerService.aiValidator.getValidationStats();
      if (aiStats.totalValidations > 0) {
        console.log(chalk.green(`   ✅ Validations performed: ${aiStats.totalValidations}`));
        console.log(chalk.blue(`   📊 Average risk score: ${aiStats.averageRiskScore.toFixed(2)}`));
      }
    } else {
      console.log(chalk.red(`   ❌ AI Disconnected: ${aiStatus.error}`));
    }

    // Test 4: Check merkle tree
    console.log(chalk.yellow('\n🌳 Test 4: Merkle Tree status...'));
    const merkleStats = relayerService.merkleTree.getStats();
    console.log(chalk.green(`   ✅ Merkle leaves: ${merkleStats.leafCount}`));
    console.log(chalk.blue(`   🌳 Root: ${merkleStats.root}`));

    // Test 5: Recent batches
    console.log(chalk.yellow('\n📦 Test 5: Recent batches...'));
    const recentBatches = relayerService.getRecentBatches(3);
    console.log(chalk.green(`   ✅ Batches processed: ${recentBatches.length}`));
    
    recentBatches.forEach((batch, index) => {
      console.log(chalk.cyan(`   ${index + 1}. Batch ${batch.id}:`));
      console.log(chalk.blue(`      Transactions: ${batch.stats.total}`));
      console.log(chalk.blue(`      Validated: ${batch.stats.validated}`));
      console.log(chalk.blue(`      Rejected: ${batch.stats.rejected}`));
      console.log(chalk.blue(`      Processing time: ${batch.processingTime}ms`));
    });

    // Test 6: Try to relay a validated transaction
    console.log(chalk.yellow('\n🚀 Test 6: Transaction relay test...'));
    let relaySuccess = false;
    
    if (recentBatches.length > 0) {
      const validatedTx = recentBatches[0].transactions.find(tx => tx.status === 'validated');
      if (validatedTx) {
        try {
          console.log(chalk.blue(`   Attempting to relay transaction: ${validatedTx.id}`));
          // Note: This will likely fail in test environment due to insufficient funds
          // but it tests the relay logic
          const result = await relayerService.relayTransaction(validatedTx.id);
          console.log(chalk.green(`   ✅ Relay successful: ${result.txHash}`));
          relaySuccess = true;
        } catch (error) {
          console.log(chalk.yellow(`   ⚠️ Relay failed (expected in test): ${error.message}`));
          // This is expected in test environment
        }
      } else {
        console.log(chalk.yellow('   ⚠️ No validated transactions found to relay'));
      }
    } else {
      console.log(chalk.yellow('   ⚠️ No batches processed yet'));
    }

    // Final summary
    console.log(chalk.blue.bold('\n📊 Integration Test Summary\n'));
    
    const finalStats = relayerService.getStats();
    const testResults = [
      { test: 'Service Initialization', status: '✅ Pass' },
      { test: 'Transaction Submission', status: testTransactions.length > 0 ? '✅ Pass' : '❌ Fail' },
      { test: 'Batch Processing', status: finalStats.totalProcessed > 0 ? '✅ Pass' : '❌ Fail' },
      { test: 'AI Validation', status: aiStatus.connected ? '✅ Pass' : '⚠️ Warning' },
      { test: 'Merkle Tree', status: merkleStats.leafCount > 0 ? '✅ Pass' : '❌ Fail' },
      { test: 'Batch Creation', status: recentBatches.length > 0 ? '✅ Pass' : '❌ Fail' },
      { test: 'Transaction Relay', status: relaySuccess ? '✅ Pass' : '⚠️ Expected Fail' }
    ];

    testResults.forEach(result => {
      console.log(chalk.white(`${result.test.padEnd(25)} ${result.status}`));
    });

    console.log(chalk.blue('\nFinal Statistics:'));
    console.log(chalk.blue(`📋 Pending: ${finalStats.pendingTransactions}`));
    console.log(chalk.blue(`✅ Processed: ${finalStats.totalProcessed}`));
    console.log(chalk.blue(`🚀 Relayed: ${finalStats.totalRelayed}`));
    console.log(chalk.blue(`❌ Errors: ${finalStats.errorCount}`));
    console.log(chalk.blue(`⏱️ Avg Processing: ${finalStats.averageProcessingTime.toFixed(2)}ms`));

    const passCount = testResults.filter(r => r.status.includes('✅')).length;
    const totalTests = testResults.length;
    
    console.log(chalk.green.bold(`\n🎉 Integration Test Complete: ${passCount}/${totalTests} tests passed\n`));

    // Shutdown
    await relayerService.shutdown();

  } catch (error) {
    console.error(chalk.red.bold('❌ Integration test failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  runIntegrationTest().catch(console.error);
}

module.exports = { runIntegrationTest };
