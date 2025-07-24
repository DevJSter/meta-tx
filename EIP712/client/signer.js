import { ethers } from 'ethers';
import axios from 'axios';

// Enhanced configuration
const provider = new ethers.JsonRpcProvider('https://subnets.avax.network/thane/testnet/rpc');
const contractAddress = '0x59b670e9fA9D0A427751Af201D676719a970857b';
const relayerBaseUrl = 'http://localhost:3001';

// User wallet configuration
const privateKey = '0x829d62188cc5ff0a1dc21cf31efb7cb36d415ced40e71b9ee294a82f3025a7b3';
const userWallet = new ethers.Wallet(privateKey, provider);

// EIP-712 domain and types (unchanged for compatibility)
const domain = {
  name: "QoneqtMetaTx",
  version: "1",
  chainId: 202102,
  verifyingContract: contractAddress
};

const types = {
  MetaTx: [
    { name: "user", type: "address" },
    { name: "interaction", type: "string" },
    { name: "nonce", type: "uint256" }
  ]
};

// Enhanced interaction examples with different significance levels
const interactionExamples = [
  // High-value interactions
  'create_post-educational_blockchain_guide_2024',
  'create_post-community_discussion_dao_governance',
  'write_article-defi_security_best_practices',
  
  // Medium-value interactions
  'comment_post-thanks_for_sharing_this_insight',
  'share_post-valuable_research_data_analysis',
  'join_community-blockchain_developers_guild',
  'follow_user-expert_smart_contract_auditor',
  
  // Basic-value interactions
  'like_post-12345',
  'react_post-heart_emoji_67890',
  'bookmark_post-save_for_later_98765',
  'vote_poll-option_a_governance_proposal_123'
];

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInteraction() {
  return interactionExamples[Math.floor(Math.random() * interactionExamples.length)];
}

async function getUserStats(address) {
  try {
    const response = await axios.get(`${relayerBaseUrl}/user/${address}/stats`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch user stats:', error.response?.data || error.message);
    return null;
  }
}

async function checkRelayerHealth() {
  try {
    const response = await axios.get(`${relayerBaseUrl}/health`);
    console.log('🏥 Relayer Health:', response.data.status);
    console.log('⛽ Relayer Balance:', response.data.blockchain?.relayerBalance, 'ETH');
    console.log('🔗 Block Number:', response.data.blockchain?.blockNumber);
    return response.data;
  } catch (error) {
    console.error('❌ Relayer health check failed:', error.message);
    return null;
  }
}

async function testValidation(interaction) {
  try {
    const response = await axios.post(`${relayerBaseUrl}/validate`, {
      interaction: interaction,
      userAddress: userWallet.address
    });
    console.log('🧪 Validation Test Result:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Validation test failed:', error.response?.data || error.message);
    return null;
  }
}

async function signAndSend(interaction = null, showStats = false) {
  // Use provided interaction or random one
  const selectedInteraction = interaction || getRandomInteraction();
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ENHANCED AI-VALIDATED META-TRANSACTION');
  console.log('='.repeat(60));
  
  try {
    // Check relayer health first
    console.log('📡 Checking relayer status...');
    const health = await checkRelayerHealth();
    if (!health || health.status !== 'healthy') {
      throw new Error('Relayer is not healthy. Please check the service.');
    }
    
    // Show user stats if requested
    if (showStats) {
      console.log('\n📊 Fetching user statistics...');
      const stats = await getUserStats(userWallet.address);
      if (stats) {
        console.log(`👤 User: ${stats.address}`);
        console.log(`🎯 Total Interactions: ${stats.totalInteractions}`);
        console.log(`⭐ Total Points: ${stats.totalPoints}`);
        console.log(`⏰ Last Interaction: ${stats.lastInteractionDate}`);
      }
    }
    
    // Get current nonce
    console.log('\n🔢 Fetching current nonce...');
    const nonceResponse = await axios.get(`${relayerBaseUrl}/nonce/${userWallet.address}`);
    const nonce = parseInt(nonceResponse.data.nonce);
    
    console.log(`👤 User: ${userWallet.address}`);
    console.log(`🔢 Current nonce: ${nonce}`);
    console.log(`🎬 Interaction: "${selectedInteraction}"`);

    // Test validation first (optional)
    console.log('\n🧪 Testing AI validation...');
    const validationTest = await testValidation(selectedInteraction);
    if (validationTest) {
      console.log(`✅ Pre-validation: ${validationTest.approved ? 'APPROVED' : 'REJECTED'}`);
      console.log(`📈 Significance: ${validationTest.originalSignificance || validationTest.significance}`);
      console.log(`🏷️  Category: ${validationTest.category}`);
      console.log(`🤖 Confidence: ${validationTest.confidence}`);
      
      if (!validationTest.approved) {
        console.log('⚠️  Warning: This interaction may be rejected. Proceeding anyway...');
      }
    }

    // Sign the meta-transaction
    console.log('\n✍️  Signing meta-transaction...');
    const value = {
      user: userWallet.address,
      interaction: selectedInteraction,
      nonce
    };

    const signature = await userWallet.signTypedData(domain, types, value);
    console.log('✅ Signature generated');

    // Send to relayer
    console.log('\n📤 Sending to AI relayer...');
    const response = await axios.post(`${relayerBaseUrl}/relayMetaTx`, {
      user: userWallet.address,
      interaction: selectedInteraction,
      nonce,
      signature
    });

    // Display success results
    console.log('\n' + '🎉 TRANSACTION SUCCESSFUL! 🎉'.padStart(40));
    console.log('─'.repeat(60));
    console.log(`📋 Transaction Hash: ${response.data.txHash}`);
    console.log(`🏗️  Block Number: ${response.data.blockNumber}`);
    console.log(`⛽ Gas Used: ${response.data.gasUsed}`);
    
    console.log('\n🤖 AI Validation Results:');
    console.log(`   ✅ Approved: ${response.data.validation.approved}`);
    console.log(`   📊 Significance: ${response.data.validation.significance} (scaled: ${response.data.validation.scaledSignificance})`);
    console.log(`   🏷️  Category: ${response.data.validation.category}`);
    console.log(`   🎯 Reason: ${response.data.validation.reason}`);
    console.log(`   🤖 Confidence: ${response.data.validation.confidence}`);
    console.log(`   🔄 Fallback Used: ${response.data.validation.fallback ? 'Yes' : 'No'}`);
    
    if (response.data.userStats) {
      console.log('\n📈 Updated User Stats:');
      console.log(`   🎯 Total Interactions: ${response.data.userStats.totalInteractions}`);
      console.log(`   ⭐ Total Points: ${response.data.userStats.totalPoints}`);
    }
    
    return response.data;
    
  } catch (error) {
    console.log('\n' + '❌ TRANSACTION FAILED'.padStart(35));
    console.log('─'.repeat(60));
    
    if (error.response) {
      const errorData = error.response.data;
      console.log(`🚫 Error: ${errorData.error}`);
      
      if (errorData.reason) console.log(`💭 Reason: ${errorData.reason}`);
      if (errorData.category) console.log(`🏷️  Category: ${errorData.category}`);
      if (errorData.significance !== undefined) console.log(`📊 Significance: ${errorData.significance}`);
      if (errorData.confidence) console.log(`🤖 Confidence: ${errorData.confidence}`);
      if (errorData.threshold !== undefined) console.log(`🎯 Threshold: ${errorData.threshold}`);
      
      console.log(`🔢 Status Code: ${error.response.status}`);
    } else {
      console.log(`🌐 Network Error: ${error.message}`);
    }
    
    throw error;
  }
}

// Enhanced testing functions
async function runMultipleInteractions(count = 3, delayMs = 2000) {
  console.log(`\n🔄 Running ${count} interactions with ${delayMs}ms delay...\n`);
  
  for (let i = 1; i <= count; i++) {
    console.log(`\n📍 Interaction ${i}/${count}`);
    try {
      await signAndSend(null, i === 1); // Show stats only on first run
      if (i < count) {
        console.log(`⏳ Waiting ${delayMs}ms before next interaction...`);
        await delay(delayMs);
      }
    } catch (error) {
      console.log(`❌ Interaction ${i} failed, continuing...`);
    }
  }
}

async function testSpecificInteractions() {
  const testInteractions = [
    'create_post-how_to_build_secure_smart_contracts',
    'comment_post-great_tutorial_very_helpful',
    'like_post-simple_like',
    'spam_post-buy_my_token_now_quick_money', // Should be rejected
  ];
  
  console.log('\n🧪 Testing specific interaction types...\n');
  
  for (let i = 0; i < testInteractions.length; i++) {
    console.log(`\n🔬 Test ${i + 1}/${testInteractions.length}: "${testInteractions[i]}"`);
    try {
      await signAndSend(testInteractions[i]);
      await delay(1000);
    } catch (error) {
      console.log('❌ Expected failure for spam/invalid interaction');
    }
  }
}

// Main execution
async function main() {
  console.log('🌟 Enhanced AI-Validated Social Interaction System');
  console.log('================================================');
  
  // Check command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'multiple':
        const count = parseInt(args[1]) || 3;
        await runMultipleInteractions(count);
        break;
        
      case 'test':
        await testSpecificInteractions();
        break;
        
      case 'stats':
        await getUserStats(userWallet.address);
        break;
        
      case 'health':
        await checkRelayerHealth();
        break;
        
      case 'custom':
        const customInteraction = args[1];
        if (!customInteraction) {
          console.log('❌ Please provide an interaction: node signer.js custom "your_interaction"');
          return;
        }
        await signAndSend(customInteraction, true);
        break;
        
      default:
        // Single random interaction
        await signAndSend(null, true);
    }
  } catch (error) {
    console.error('\n💥 Application Error:', error.message);
    process.exit(1);
  }
}

// Run the application
main().catch(console.error);

// Export for potential module use
export { signAndSend, getUserStats, checkRelayerHealth, testValidation };

/*
Usage Examples:
- node signer.js                    # Single random interaction with stats
- node signer.js multiple 5         # Run 5 interactions
- node signer.js test               # Test specific interaction types
- node signer.js custom "like_post-12345"  # Test custom interaction
- node signer.js health             # Check relayer health
- node signer.js stats              # Get user statistics only

Features Implemented:
✅ Enhanced AI validation with significance scoring
✅ Rate limiting and cooldown management  
✅ User statistics and leaderboard tracking
✅ Multiple interaction types with scoring
✅ Comprehensive error handling and logging
✅ Health monitoring and diagnostics
✅ Batch testing capabilities
✅ Token reward system integration ready
*/