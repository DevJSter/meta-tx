import { ethers } from 'ethers';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config/env');

// Use centralized configuration
const {
  blockchain,
  eip712,
  server,
  interactions,
  helpers
} = config;

// Enhanced configuration
const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
const contractAddress = blockchain.contractAddress;
const relayerBaseUrl = server.relayerBaseUrl;

// Wallet 1 configuration
const privateKey = '0x829d62188cc5ff0a1dc21cf31efb7cb36d415ced40e71b9ee294a82f3025a7b3';
const userWallet = new ethers.Wallet(privateKey, provider);

// EIP-712 domain and types from centralized config
const domain = eip712.domain;
const types = eip712.types;

// High significance interactions
const highInteractions = [
  'create_post-comprehensive_blockchain_security_guide_2024',
  'create_post-defi_protocol_architecture_deep_dive',
  'write_article-smart_contract_auditing_best_practices',
  'create_post-ethereum_layer2_scaling_solutions_analysis',
  'write_article-dao_governance_framework_implementation',
  'create_post-nft_marketplace_development_tutorial',
  'create_post-cross_chain_bridge_security_research',
  'write_article-tokenomics_design_principles_guide',
  'create_post-web3_identity_verification_systems',
  'create_post-blockchain_interoperability_protocols_study'
];

// Medium significance interactions
const mediumInteractions = [
  'comment_post-excellent_analysis_of_market_trends',
  'share_post-important_security_vulnerability_disclosure',
  'comment_post-helpful_debugging_tips_for_solidity',
  'join_community-ethereum_developers_association',
  'follow_user-blockchain_security_researcher_alice',
  'comment_post-insightful_perspective_on_dao_voting',
  'share_post-useful_web3_development_resources',
  'comment_post-great_explanation_of_consensus_mechanisms',
  'join_community-defi_protocol_builders_guild',
  'follow_user-smart_contract_auditor_bob'
];

// Low significance interactions
const lowInteractions = [
  'like_post-interesting_blockchain_news_12345',
  'react_post-thumbs_up_emoji_67890',
  'bookmark_post-save_for_later_reading_98765',
  'vote_poll-option_b_favorite_consensus_algorithm',
  'like_post-daily_crypto_market_update_54321',
  'react_post-fire_emoji_amazing_project_11111',
  'bookmark_post-technical_documentation_reference_22222',
  'vote_poll-option_a_best_layer2_solution_33333',
  'like_post-weekly_defi_protocol_review_44444',
  'react_post-heart_emoji_inspiring_story_55555'
];

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function signAndSend(interaction, category) {
  console.log(`\n📝 [WALLET-1] Processing ${category} interaction: "${interaction}"`);
  
  try {
    // Get current nonce
    const nonceResponse = await axios.get(`${relayerBaseUrl}/nonce/${userWallet.address}`);
    const nonce = parseInt(nonceResponse.data.nonce);
    
    console.log(`👤 User: ${userWallet.address}`);
    console.log(`🔢 Nonce: ${nonce}`);

    // Sign the meta-transaction
    const value = {
      user: userWallet.address,
      interaction: interaction,
      nonce
    };

    const signature = await userWallet.signTypedData(domain, types, value);

    // Send to relayer
    const response = await axios.post(`${relayerBaseUrl}/relayMetaTx`, {
      user: userWallet.address,
      interaction: interaction,
      nonce,
      signature
    });

    // Display results
    console.log(`✅ ${category} Transaction successful!`);
    console.log(`📋 TX Hash: ${response.data.txHash}`);
    console.log(`📊 Significance: ${response.data.validation.significance}`);
    console.log(`🏷️  Category: ${response.data.validation.category}`);
    console.log(`⭐ Points Earned: ${response.data.userStats?.totalPoints || 0}`);
    
    return response.data;
    
  } catch (error) {
    console.log(`❌ ${category} Transaction failed: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

async function runAllInteractions() {
  console.log('\n🚀 WALLET-1 MULTI-CATEGORY INTERACTION TEST');
  console.log('==========================================');
  console.log(`👤 Wallet Address: ${userWallet.address}`);
  console.log('📊 Test Plan: 10 High + 10 Medium + 10 Low interactions\n');

  let successCount = 0;
  let totalCount = 0;

  // Process High significance interactions
  console.log('\n🔴 === HIGH SIGNIFICANCE INTERACTIONS (10) ===');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(highInteractions);
      await signAndSend(interaction, 'HIGH');
      successCount++;
      await delay(1500); // 1.5s delay between transactions
    } catch (error) {
      console.log(`❌ High interaction ${i + 1} failed, continuing...`);
    }
  }

  // Process Medium significance interactions
  console.log('\n🟡 === MEDIUM SIGNIFICANCE INTERACTIONS (10) ===');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(mediumInteractions);
      await signAndSend(interaction, 'MEDIUM');
      successCount++;
      await delay(1200); // 1.2s delay between transactions
    } catch (error) {
      console.log(`❌ Medium interaction ${i + 1} failed, continuing...`);
    }
  }

  // Process Low significance interactions
  console.log('\n🟢 === LOW SIGNIFICANCE INTERACTIONS (10) ===');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(lowInteractions);
      await signAndSend(interaction, 'LOW');
      successCount++;
      await delay(1000); // 1s delay between transactions
    } catch (error) {
      console.log(`❌ Low interaction ${i + 1} failed, continuing...`);
    }
  }

  // Final summary
  console.log('\n🏁 WALLET-1 TEST COMPLETE');
  console.log('========================');
  console.log(`✅ Successful: ${successCount}/${totalCount}`);
  console.log(`❌ Failed: ${totalCount - successCount}/${totalCount}`);
  console.log(`📊 Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%`);
}

// Main execution
async function main() {
  try {
    await runAllInteractions();
  } catch (error) {
    console.error('\n💥 Application Error:', error.message);
    process.exit(1);
  }
}

// Run the application
main().catch(console.error);

// Export for potential module use
export { signAndSend, runAllInteractions };

/*
WALLET-1 TEST CONFIGURATION:
- Private Key: 0x829d62188cc5ff0a1dc21cf31efb7cb36d415ced40e71b9ee294a82f3025a7b3
- Test Plan: 10 High + 10 Medium + 10 Low significance interactions
- Random selection from predefined arrays for each category
- Progressive delays: 1.5s (high) -> 1.2s (medium) -> 1s (low)
- Comprehensive success/failure tracking and reporting
*/
