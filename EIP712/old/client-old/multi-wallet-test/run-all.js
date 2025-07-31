import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WALLET_SCRIPTS = [
  { name: 'WALLET-1', script: 'wallet1.js', color: '\x1b[31m' }, // Red
  { name: 'WALLET-2', script: 'wallet2.js', color: '\x1b[33m' }, // Yellow
  { name: 'WALLET-3', script: 'wallet3.js', color: '\x1b[32m' }  // Green
];

const RESET_COLOR = '\x1b[0m';

function createLogger(walletName, color) {
  return {
    log: (message) => {
      console.log(`${color}[${walletName}]${RESET_COLOR} ${message}`);
    },
    error: (message) => {
      console.error(`${color}[${walletName}] ERROR:${RESET_COLOR} ${message}`);
    }
  };
}

async function runWalletScript(walletConfig) {
  return new Promise((resolve, reject) => {
    const logger = createLogger(walletConfig.name, walletConfig.color);
    const scriptPath = path.join(__dirname, walletConfig.script);
    
    logger.log(`Starting execution...`);
    
    const child = spawn('node', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log each line with wallet prefix
      output.split('\n').forEach(line => {
        if (line.trim()) {
          logger.log(line);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      logger.error(output);
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.log(`✅ Completed successfully`);
        resolve({
          wallet: walletConfig.name,
          success: true,
          code,
          stdout,
          stderr
        });
      } else {
        logger.error(`❌ Exited with code ${code}`);
        resolve({
          wallet: walletConfig.name,
          success: false,
          code,
          stdout,
          stderr
        });
      }
    });

    child.on('error', (error) => {
      logger.error(`Failed to start: ${error.message}`);
      reject({
        wallet: walletConfig.name,
        success: false,
        error: error.message
      });
    });
  });
}

async function runSequentially() {
  console.log('\n🔄 SEQUENTIAL EXECUTION MODE');
  console.log('============================');
  console.log('Running wallets one after another...\n');

  const results = [];
  
  for (const walletConfig of WALLET_SCRIPTS) {
    try {
      console.log(`\n🚀 Starting ${walletConfig.name}...`);
      const result = await runWalletScript(walletConfig);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${walletConfig.name} completed successfully`);
      } else {
        console.log(`❌ ${walletConfig.name} failed with code ${result.code}`);
      }
      
      // Add delay between wallets
      if (walletConfig !== WALLET_SCRIPTS[WALLET_SCRIPTS.length - 1]) {
        console.log('\n⏳ Waiting 3 seconds before next wallet...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`💥 ${walletConfig.name} failed to start:`, error.error);
      results.push(error);
    }
  }

  return results;
}

async function runConcurrently() {
  console.log('\n⚡ CONCURRENT EXECUTION MODE');
  console.log('============================');
  console.log('Running all wallets simultaneously...\n');

  const promises = WALLET_SCRIPTS.map(walletConfig => {
    console.log(`🚀 Starting ${walletConfig.name}...`);
    return runWalletScript(walletConfig);
  });

  try {
    const results = await Promise.allSettled(promises);
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );
  } catch (error) {
    console.error('💥 Concurrent execution failed:', error);
    return [];
  }
}

function displaySummary(results) {
  console.log('\n📊 EXECUTION SUMMARY');
  console.log('===================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`📈 Success Rate: ${((successful / results.length) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.wallet}: ${result.success ? 'SUCCESS' : `FAILED (${result.code || 'ERROR'})`}`);
  });
}

async function main() {
  console.log('🌟 MULTI-WALLET AI-VALIDATED INTERACTION TESTER');
  console.log('===============================================');
  console.log('🎯 Test Plan: 3 wallets × 30 interactions each (90 total)');
  console.log('📊 Categories: 10 High + 10 Medium + 10 Low per wallet');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const mode = args[0] || 'sequential';
  
  console.log(`🔧 Execution Mode: ${mode.toUpperCase()}`);
  
  let results = [];
  const startTime = Date.now();
  
  try {
    switch (mode.toLowerCase()) {
      case 'concurrent':
      case 'parallel':
        results = await runConcurrently();
        break;
        
      case 'sequential':
      case 'seq':
      default:
        results = await runSequentially();
        break;
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    displaySummary(results);
    console.log(`\n⏱️  Total Execution Time: ${duration} seconds`);
    
  } catch (error) {
    console.error('\n💥 Master Script Error:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Execution interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Execution terminated');
  process.exit(0);
});

// Run the application
main().catch(console.error);

/*
MULTI-WALLET MASTER SCRIPT USAGE:
- node run-all.js                    # Sequential execution (default)
- node run-all.js sequential         # Sequential execution
- node run-all.js concurrent         # Concurrent execution
- node run-all.js parallel           # Concurrent execution (alias)

FEATURES:
✅ Sequential or concurrent execution modes
✅ Color-coded output for each wallet
✅ Comprehensive error handling and logging
✅ Execution time tracking
✅ Success/failure statistics
✅ Graceful interruption handling
✅ Real-time progress monitoring

NEW CONFIGURATION:
🆕 Each wallet script now uses random wallet addresses for every transaction
🆕 Completely bypasses cooldown restrictions (no more "contract on cooldown" errors)
🆕 Unlimited testing capacity with fresh wallets
🆕 Perfect for comprehensive AI validation testing
*/
