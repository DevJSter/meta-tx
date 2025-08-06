require('dotenv').config();
const { ethers } = require('ethers');
const chalk = require('chalk');

class EventScanner {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contracts = {
      systemDeployer: process.env.SYSTEM_DEPLOYER_ADDRESS,
      accessControl: process.env.ACCESS_CONTROL_ADDRESS,
      dailyTree: process.env.DAILY_TREE_ADDRESS,
      merkleDistributor: process.env.MERKLE_DISTRIBUTOR_ADDRESS,
      stabilizingContract: process.env.STABILIZING_CONTRACT_ADDRESS,
      relayerTreasury: process.env.RELAYER_TREASURY_ADDRESS
    };
  }

  async scanEvents(contractAddress, fromBlock = 'latest', toBlock = 'latest', eventFilter = null) {
    try {
      console.log(chalk.blue(`🔍 Scanning events for ${contractAddress}`));
      console.log(chalk.blue(`   From block: ${fromBlock} | To block: ${toBlock}`));

      const filter = {
        address: contractAddress,
        fromBlock,
        toBlock,
        topics: eventFilter ? [eventFilter] : undefined
      };

      const logs = await this.provider.getLogs(filter);
      
      console.log(chalk.green(`✅ Found ${logs.length} events`));
      
      return logs.map((log, index) => ({
        index,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        address: log.address,
        topics: log.topics,
        data: log.data,
        logIndex: log.logIndex
      }));

    } catch (error) {
      console.error(chalk.red(`❌ Error scanning events: ${error.message}`));
      return [];
    }
  }

  async scanAllContracts(fromBlock = 'latest', toBlock = 'latest') {
    console.log(chalk.blue.bold('\n📡 Scanning All QOBI Contracts for Events\n'));

    const results = {};

    for (const [name, address] of Object.entries(this.contracts)) {
      if (address && ethers.isAddress(address)) {
        console.log(chalk.yellow(`Scanning ${name}...`));
        const events = await this.scanEvents(address, fromBlock, toBlock);
        results[name] = {
          address,
          events,
          eventCount: events.length
        };
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log(chalk.red(`❌ Invalid address for ${name}: ${address}`));
        results[name] = { address, events: [], eventCount: 0, error: 'Invalid address' };
      }
    }

    return results;
  }

  async getLatestBlocks(count = 10) {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      console.log(chalk.blue(`📦 Latest block: ${latestBlock}`));

      const blocks = [];
      for (let i = 0; i < count; i++) {
        const blockNumber = latestBlock - i;
        if (blockNumber >= 0) {
          const block = await this.provider.getBlock(blockNumber);
          blocks.push({
            number: block.number,
            hash: block.hash,
            timestamp: block.timestamp,
            transactionCount: block.transactions.length,
            gasUsed: block.gasUsed.toString(),
            gasLimit: block.gasLimit.toString()
          });
        }
      }

      return blocks;
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching blocks: ${error.message}`));
      return [];
    }
  }

  async getContractCode(address) {
    try {
      const code = await this.provider.getCode(address);
      return {
        address,
        hasCode: code !== '0x',
        codeSize: code.length,
        code: code.slice(0, 100) + (code.length > 100 ? '...' : '')
      };
    } catch (error) {
      console.error(chalk.red(`❌ Error fetching code for ${address}: ${error.message}`));
      return { address, hasCode: false, error: error.message };
    }
  }

  async verifyContracts() {
    console.log(chalk.blue.bold('\n🔍 Verifying QOBI Contract Deployments\n'));

    const results = {};

    for (const [name, address] of Object.entries(this.contracts)) {
      if (address && ethers.isAddress(address)) {
        console.log(chalk.yellow(`Verifying ${name} at ${address}...`));
        
        const codeInfo = await this.getContractCode(address);
        const balance = await this.provider.getBalance(address);
        
        results[name] = {
          address,
          deployed: codeInfo.hasCode,
          balance: ethers.formatEther(balance),
          codeSize: codeInfo.codeSize,
          status: codeInfo.hasCode ? '✅ Deployed' : '❌ Not deployed'
        };

        console.log(chalk.green(`   ${results[name].status}`));
        console.log(chalk.blue(`   Balance: ${results[name].balance} ETH`));
        console.log(chalk.blue(`   Code size: ${results[name].codeSize} bytes`));
        
      } else {
        results[name] = {
          address,
          deployed: false,
          error: 'Invalid address',
          status: '❌ Invalid address'
        };
        console.log(chalk.red(`❌ ${name}: Invalid address`));
      }
    }

    return results;
  }

  async monitorRealTime() {
    console.log(chalk.blue.bold('\n👁️ Starting Real-time Event Monitor\n'));
    console.log(chalk.yellow('Press Ctrl+C to stop monitoring...'));

    // Monitor new blocks
    this.provider.on('block', async (blockNumber) => {
      console.log(chalk.cyan(`📦 New block: ${blockNumber}`));
      
      // Check for events in the new block
      for (const [name, address] of Object.entries(this.contracts)) {
        if (address && ethers.isAddress(address)) {
          const events = await this.scanEvents(address, blockNumber, blockNumber);
          if (events.length > 0) {
            console.log(chalk.green(`   🎯 ${name}: ${events.length} events`));
            events.forEach(event => {
              console.log(chalk.blue(`      TX: ${event.transactionHash}`));
            });
          }
        }
      }
    });

    // Keep the process running
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n📴 Stopping real-time monitor...'));
      this.provider.removeAllListeners();
      process.exit(0);
    });
  }

  async generateReport() {
    console.log(chalk.blue.bold('\n📊 Generating QOBI Event Scanner Report\n'));

    // Get network info
    const network = await this.provider.getNetwork();
    const latestBlock = await this.provider.getBlockNumber();

    // Verify contracts
    const contractStatus = await this.verifyContracts();

    // Scan recent events
    const fromBlock = Math.max(0, latestBlock - 1000); // Last 1000 blocks
    const eventResults = await this.scanAllContracts(fromBlock, latestBlock);

    // Get recent blocks
    const recentBlocks = await this.getLatestBlocks(5);

    // Compile report
    const report = {
      timestamp: new Date().toISOString(),
      network: {
        name: network.name,
        chainId: network.chainId.toString(),
        latestBlock
      },
      contracts: contractStatus,
      events: eventResults,
      recentBlocks,
      summary: {
        totalContracts: Object.keys(this.contracts).length,
        deployedContracts: Object.values(contractStatus).filter(c => c.deployed).length,
        totalEvents: Object.values(eventResults).reduce((sum, r) => sum + r.eventCount, 0),
        scannedBlocks: latestBlock - fromBlock + 1
      }
    };

    // Display summary
    console.log(chalk.green.bold('📋 Report Summary:'));
    console.log(chalk.blue(`   Network: ${report.network.name} (${report.network.chainId})`));
    console.log(chalk.blue(`   Latest Block: ${report.network.latestBlock}`));
    console.log(chalk.blue(`   Contracts: ${report.summary.deployedContracts}/${report.summary.totalContracts} deployed`));
    console.log(chalk.blue(`   Events Found: ${report.summary.totalEvents}`));
    console.log(chalk.blue(`   Blocks Scanned: ${report.summary.scannedBlocks}`));

    console.log(chalk.green.bold('\n📊 Contract Status:'));
    Object.entries(contractStatus).forEach(([name, status]) => {
      console.log(chalk.white(`   ${name.padEnd(20)} ${status.status}`));
    });

    if (report.summary.totalEvents > 0) {
      console.log(chalk.green.bold('\n🎯 Event Summary:'));
      Object.entries(eventResults).forEach(([name, result]) => {
        if (result.eventCount > 0) {
          console.log(chalk.cyan(`   ${name}: ${result.eventCount} events`));
        }
      });
    }

    return report;
  }
}

async function main() {
  const scanner = new EventScanner();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'report';

  switch (command) {
    case 'report':
      await scanner.generateReport();
      break;
    case 'verify':
      await scanner.verifyContracts();
      break;
    case 'monitor':
      await scanner.monitorRealTime();
      break;
    case 'events':
      const fromBlock = args[1] || 'latest';
      const toBlock = args[2] || 'latest';
      await scanner.scanAllContracts(fromBlock, toBlock);
      break;
    default:
      console.log(chalk.blue('Usage: node event-scanner.js [command]'));
      console.log(chalk.blue('Commands:'));
      console.log(chalk.blue('  report  - Generate full report (default)'));
      console.log(chalk.blue('  verify  - Verify contract deployments'));
      console.log(chalk.blue('  monitor - Real-time event monitoring'));
      console.log(chalk.blue('  events [from] [to] - Scan events in block range'));
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EventScanner;
