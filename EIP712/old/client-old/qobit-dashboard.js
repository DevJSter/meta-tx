import { ethers } from 'ethers';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config/env');

// Use centralized configuration
const {
  blockchain,
  wallet: walletConfig,
  eip712,
  server,
  interactions,
  helpers
} = config;

// Configuration from centralized config
const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
const qobitTokenAddress = blockchain.qobitContractAddress;
const metaTxContractAddress = blockchain.contractAddress;
const relayerBaseUrl = server.relayerBaseUrl;

// User wallet (using an alternative test account for dashboard)
const privateKey = '0x59c6995e998f97436de2d8d75b5e46c8b32b4acd5ee8a4a71a5b073e7a6b9ad0';
const userWallet = new ethers.Wallet(privateKey, provider);

// Qobit Token ABI (updated with actual functions)
const qobitTokenAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)", 
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

class QobitDashboard {
  constructor() {
    this.tokenContract = new ethers.Contract(qobitTokenAddress, qobitTokenAbi, userWallet);
  }

  async displayDashboard() {
    console.log('\n' + '🎯 QOBIT TOKEN DASHBOARD 🎯'.center(60));
    console.log('═'.repeat(60));
    
    try {
      // Get basic token info
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.tokenContract.name(),
        this.tokenContract.symbol(), 
        this.tokenContract.decimals(),
        this.tokenContract.totalSupply()
      ]);
      
      console.log(`📄 Token: ${name} (${symbol})`);
      console.log(`� Decimals: ${decimals}`);
      console.log(`📊 Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
      console.log('─'.repeat(60));
      
      // Get user balance
      const balance = await this.tokenContract.balanceOf(userWallet.address);
      console.log(`👤 User: ${userWallet.address}`);
      console.log(`💰 Balance: ${ethers.formatEther(balance)} ${symbol}`);
      
      // Get user stats from meta-transaction contract
      await this.displayUserStats();
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error.message);
    }
  }

  async displayUserStats() {
    try {
      console.log('─'.repeat(60));
      console.log('📈 Meta-Transaction Stats:');
      
      const response = await axios.get(`${relayerBaseUrl}/user/${userWallet.address}/stats`);
      const stats = response.data;
      
      console.log(`⭐ Total Interactions: ${stats.totalInteractions}`);
      console.log(`🏆 Total Points: ${stats.totalPoints}`);
      
      if (stats.lastInteractionTime !== '0') {
        const lastInteraction = new Date(parseInt(stats.lastInteractionTime) * 1000);
        console.log(`� Last Interaction: ${lastInteraction.toLocaleString()}`);
      } else {
        console.log(`🕒 Last Interaction: Never`);
      }
      
      // Get current nonce
      const nonceResponse = await axios.get(`${relayerBaseUrl}/nonce/${userWallet.address}`);
      console.log(`� Current Nonce: ${nonceResponse.data.nonce}`);
      
    } catch (error) {
      console.log(`❌ Relayer not available: ${relayerBaseUrl}`);
      console.log(`💡 Start relayer with: node ollama-relayer.js`);
      console.log(`🔍 Check transactions with: node verify-signer.js`);
    }
  }

  async showRecentTransactions(limit = 5) {
    console.log('\n' + '📋 RECENT META-TRANSACTIONS 📋'.center(60));
    console.log('═'.repeat(60));
    
    try {
      const response = await axios.get(`${relayerBaseUrl}/health`);
      console.log(`🟢 Relayer Status: ${response.data.status}`);
      console.log(`🤖 AI Model: ${response.data.config.model}`);
      console.log(`⚡ Rate Limit: ${response.data.config.rateLimit}`);
      console.log('');
      
      console.log('To see recent transactions, run:');
      console.log('  node verify-signer.js');
      
    } catch (error) {
      console.error('❌ Error connecting to relayer:', error.message);
    }
  }

  async testRelayerConnection() {
    console.log('\n💰 Testing relayer connection and performing sample interaction...');
    
    try {
      // Test relayer health
      const healthResponse = await axios.get(`${relayerBaseUrl}/health`);
      console.log('✅ Relayer is healthy!');
      console.log(`🔗 Blockchain connected: Block ${healthResponse.data.blockchain.blockNumber}`);
      console.log(`⛽ Relayer balance: ${healthResponse.data.blockchain.relayerBalance} AVAX`);
      
      // Test AI validation
      const testInteraction = 'comment_reply-testing_dashboard_connection';
      console.log(`\n🧪 Testing AI validation for: "${testInteraction}"`);
      
      const validationResponse = await axios.post(`${relayerBaseUrl}/validate`, {
        interaction: testInteraction,
        userAddress: userWallet.address
      });
      
      console.log(`🤖 AI Decision: ${validationResponse.data.approved ? 'APPROVED' : 'REJECTED'}`);
      console.log(`📊 Significance: ${validationResponse.data.originalSignificance}`);
      console.log(`📂 Category: ${validationResponse.data.category}`);
      console.log(`� Reason: ${validationResponse.data.reason}`);
      
      if (validationResponse.data.approved) {
        console.log('\n✅ System is ready for meta-transactions!');
      }
      
    } catch (error) {
      console.error('❌ Connection test failed:', error.response?.data?.error || error.message);
    }
  }

  async interactAndEarnPoints(interactionCount = 3) {
    console.log(`\n🎮 Performing ${interactionCount} interactions to earn points...`);
    
    const interactions = [
      'create_post-daily_market_analysis_defi',
      'comment_post-excellent_breakdown_of_tokenomics',
      'share_post-important_security_update',
      'like_post-community_governance_proposal',
      'join_community-web3_developers_guild'
    ];
    
    for (let i = 0; i < interactionCount; i++) {
      const interaction = interactions[i % interactions.length] + '_' + Date.now();
      console.log(`\n📝 Interaction ${i + 1}: ${interaction}`);
      
      try {
        // Use the enhanced signer logic
        const response = await this.performInteraction(interaction);
        if (response.success) {
          console.log(`✅ Success! Points earned: ${response.validation.scaledSignificance}`);
        }
        
        // Small delay between interactions
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ Interaction ${i + 1} failed:`, error.response?.data?.error || error.message);
      }
    }
  }

  async performInteraction(interaction) {
    // Get nonce
    const nonceResponse = await axios.get(`${relayerBaseUrl}/nonce/${userWallet.address}`);
    const nonce = parseInt(nonceResponse.data.nonce);
    
    // Sign transaction with correct domain and types
    const domain = {
      name: "MetaTxInteraction",
      version: "1",
      chainId: 202102, // Avalanche testnet chain ID
      verifyingContract: metaTxContractAddress
    };
    
    const types = {
      MetaTx: [
        { name: "user", type: "address" },
        { name: "interaction", type: "string" },
        { name: "nonce", type: "uint256" }
      ]
    };
    
    const value = {
      user: userWallet.address,
      interaction,
      nonce
    };
    
    const signature = await userWallet.signTypedData(domain, types, value);
    
    // Send to relayer
    const response = await axios.post(`${relayerBaseUrl}/relayMetaTx`, {
      user: userWallet.address,
      interaction,
      nonce,
      signature
    });
    
    return response.data;
  }
}

// Enhanced String prototype for centering
String.prototype.center = function(length) {
  const padding = Math.max(0, length - this.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + this + ' '.repeat(right);
};

// Main application
async function main() {
  const dashboard = new QobitDashboard();
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'dashboard':
      case 'status':
        await dashboard.displayDashboard();
        break;
        
      case 'transactions':
      case 'recent':
        await dashboard.showRecentTransactions();
        break;
        
      case 'test':
        await dashboard.testRelayerConnection();
        break;
        
      case 'earn':
        const count = parseInt(args[1]) || 3;
        await dashboard.interactAndEarnPoints(count);
        break;
        
      case 'full':
        await dashboard.displayDashboard();
        await dashboard.showRecentTransactions();
        await dashboard.interactAndEarnPoints(2);
        await dashboard.displayDashboard();
        break;
        
      default:
        console.log('\n🎯 Qobit Token Dashboard');
        console.log('========================');
        console.log('Available commands:');
        console.log('  node qobit-dashboard.js dashboard     # Show user stats and token info');
        console.log('  node qobit-dashboard.js transactions  # Show recent transactions info');
        console.log('  node qobit-dashboard.js test          # Test relayer connection');
        console.log('  node qobit-dashboard.js earn [count]  # Perform interactions (default: 3)');
        console.log('  node qobit-dashboard.js full          # Full demo workflow');
        console.log('\nCurrent Configuration:');
        console.log(`  🔗 RPC: ${blockchain.rpcUrl}`);
        console.log(`  💰 Token: ${qobitTokenAddress}`);
        console.log(`  📄 Contract: ${metaTxContractAddress}`);
        console.log(`  🚀 Relayer: ${relayerBaseUrl}`);
        console.log(`  👤 User: ${userWallet.address}`);
    }
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

export default QobitDashboard;
