import { ethers } from 'ethers';

// Configuration
const RPC_URL = 'https://subnets.avax.network/thane/testnet/rpc';
const CONTRACT_ADDRESS = '0x59b670e9fA9D0A427751Af201D676719a970857b';

// Contract ABI for events  
const contractABI = [
  "event InteractionPerformed(address indexed user, string interaction, uint256 significance, uint256 indexed nonce, bytes32 indexed txHash)"
];

async function getLatestMetaTransactions() {
  console.log('🔍 Fetching last 10 meta-transactions from the contract...');
  console.log('================================================================');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
  
  try {
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log('');
    
    // Query InteractionPerformed events from the last 1000 blocks
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = contract.filters.InteractionPerformed();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    if (events.length === 0) {
      console.log('❌ No meta-transactions found in recent blocks');
      return;
    }
    
    // Get the last 10 events (most recent first)
    const recentEvents = events.slice(-10).reverse();
    
    console.log(`📋 Found ${events.length} total meta-transactions, showing last ${recentEvents.length}:`);
    console.log('');
    
    for (let i = 0; i < recentEvents.length; i++) {
      const event = recentEvents[i];
      const txHash = event.transactionHash;
      
      console.log(`🔸 Meta-Transaction #${i + 1}`);
      console.log('─'.repeat(50));
      
      // Get transaction receipt for gas details
      const receipt = await provider.getTransactionReceipt(txHash);
      
      console.log('📄 Transaction Details:');
      console.log(`   From (Gas Payer): ${receipt.from}`);
      console.log(`   To (Contract): ${receipt.to}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      console.log('');
      
      console.log('✅ Event Found: InteractionPerformed');
      console.log(`   Real User (Original Signer): ${event.args.user}`);
      console.log(`   Interaction: "${event.args.interaction}"`);
      console.log(`   Significance: ${event.args.significance.toString()}`);
      console.log(`   Nonce: ${event.args.nonce.toString()}`);
      console.log(`   Transaction Hash: ${event.args.txHash}`);
      console.log('');
      
      console.log('🎯 VERIFICATION RESULT:');
      console.log(`   ✅ Original Signer: ${event.args.user}`);
      console.log(`   ✅ Gas Paid By: ${receipt.from}`);
      console.log(`   ✅ Different Addresses: ${event.args.user.toLowerCase() !== receipt.from.toLowerCase()}`);
      console.log('');
      
      if (event.args.user.toLowerCase() !== receipt.from.toLowerCase()) {
        console.log('✅ This is a valid meta-transaction!');
        console.log('   - User signed without paying gas');
        console.log('   - Relayer paid gas and submitted');
        console.log('   - User gets the reputation rewards');
      } else {
        console.log('ℹ️  This is a direct transaction (not meta-tx)');
      }
      
      if (i < recentEvents.length - 1) {
        console.log('');
        console.log('═'.repeat(60));
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching meta-transactions:', error.message);
  }
}

async function verifySpecificTransaction(txHash) {
  console.log('🔍 Verifying specific transaction:', txHash);
  console.log('===============================================');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
  
  try {
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log('❌ Transaction not found');
      return;
    }
    
    console.log('📄 Transaction Details:');
    console.log(`   From (Gas Payer): ${receipt.from}`);
    console.log(`   To (Contract): ${receipt.to}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log('');
    
    // Parse logs to find events
    const logs = receipt.logs;
    let realUser = null;
    let interaction = null;
    let significance = null;
    
    for (const log of logs) {
      try {
        if (log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()) {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog.name === 'InteractionPerformed') {
            realUser = parsedLog.args.user;
            interaction = parsedLog.args.interaction;
            significance = parsedLog.args.significance;
            
            console.log('✅ Event Found:', parsedLog.name);
            console.log(`   Real User (Original Signer): ${realUser}`);
            console.log(`   Interaction: "${interaction}"`);
            console.log(`   Significance: ${significance.toString()}`);
            console.log(`   Nonce: ${parsedLog.args.nonce.toString()}`);
            console.log(`   Transaction Hash: ${parsedLog.args.txHash}`);
            console.log('');
          }
        }
      } catch (e) {
        // Skip logs that don't match our contract
      }
    }
    
    if (realUser) {
      console.log('🎯 VERIFICATION RESULT:');
      console.log(`   ✅ Original Signer: ${realUser}`);
      console.log(`   ✅ Gas Paid By: ${receipt.from}`);
      console.log(`   ✅ Different Addresses: ${realUser.toLowerCase() !== receipt.from.toLowerCase()}`);
      console.log('');
      
      if (realUser.toLowerCase() !== receipt.from.toLowerCase()) {
        console.log('✅ This is a valid meta-transaction!');
        console.log('   - User signed without paying gas');
        console.log('   - Relayer paid gas and submitted');
        console.log('   - User gets the reputation rewards');
      } else {
        console.log('ℹ️  This is a direct transaction (not meta-tx)');
      }
    } else {
      console.log('❌ No InteractionPerformed event found');
      console.log('   This might not be a meta-transaction');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // No arguments provided - show last 10 meta-transactions
  getLatestMetaTransactions().catch(console.error);
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log('🔍 Meta-Transaction Verification Tool');
  console.log('====================================');
  console.log('');
  console.log('Usage:');
  console.log('  node verify-signer.js                    # Show last 10 meta-transactions');
  console.log('  node verify-signer.js <txHash>           # Verify specific transaction');
  console.log('  node verify-signer.js --help             # Show this help');
  console.log('');
} else {
  // Transaction hash provided - verify specific transaction
  const txHash = args[0];
  verifySpecificTransaction(txHash).catch(console.error);
}
