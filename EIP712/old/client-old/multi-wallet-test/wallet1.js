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

// Function to create a random wallet for each transaction
function createRandomWallet() {
  const randomWallet = ethers.Wallet.createRandom();
  return randomWallet.connect(provider);
}

// EIP-712 domain and types from centralized config
const domain = eip712.domain;
const types = eip712.types;

// High significance interactions (Expected: >6.0 - should be ACCEPTED)
const highInteractions = [
  'create_post-comprehensive_blockchain_security_audit_methodologies_and_best_practices_for_enterprise_defi_protocols_2024',
  'write_article-advanced_ethereum_virtual_machine_optimization_techniques_for_gas_efficient_smart_contract_development',
  'create_post-zero_knowledge_proofs_implementation_guide_for_privacy_preserving_decentralized_applications',
  'write_article-comprehensive_analysis_of_layer2_scaling_solutions_rollups_sidechains_and_state_channels',
  'create_post-dao_governance_framework_design_principles_token_economics_and_voting_mechanisms_research',
  'write_article-cross_chain_interoperability_protocols_bridge_security_and_atomic_swap_implementations',
  'create_post-nft_marketplace_architecture_smart_contract_design_patterns_and_royalty_distribution_systems',
  'write_article-institutional_defi_adoption_regulatory_compliance_and_risk_management_strategies',
  'create_post-blockchain_consensus_mechanisms_comparative_analysis_proof_of_stake_vs_proof_of_work_efficiency',
  'write_article-web3_identity_management_decentralized_identity_protocols_and_privacy_preservation_methods'
];

// Medium significance interactions (Expected: 3.0-5.9 - should be ACCEPTED)
const mediumInteractions = [
  'comment_post-excellent_technical_analysis_of_ethereum_merge_implications_for_validators_and_staking_rewards',
  'share_post-important_security_vulnerability_disclosure_in_popular_defi_lending_protocol_community_alert',
  'comment_post-helpful_debugging_guide_for_solidity_reentrancy_attacks_and_prevention_strategies',
  'join_community-ethereum_core_developers_association_contributing_to_protocol_development',
  'follow_user-blockchain_security_researcher_specializing_in_smart_contract_formal_verification',
  'comment_post-insightful_perspective_on_dao_treasury_management_and_decentralized_governance_models',
  'share_post-comprehensive_web3_development_resources_tools_frameworks_and_educational_materials',
  'comment_post-detailed_explanation_of_consensus_mechanisms_and_their_impact_on_network_decentralization',
  'join_community-defi_protocol_builders_guild_for_collaborative_development_and_code_reviews',
  'follow_user-experienced_smart_contract_auditor_with_expertise_in_defi_and_nft_protocols'
];

// Low significance interactions (Expected: <0.1 - should be REJECTED)
const lowInteractions = [
  'like_post-12345',
  'react_post-👍',
  'bookmark_post-save',
  'vote_poll-a',
  'like_post-news',
  'react_post-❤️',
  'bookmark_post-later',
  'vote_poll-yes',
  'like_post-update',
  'react_post-🔥'
];

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function signAndSend(interaction, category, maxRetries = 3) {
  console.log(`\n📝 [WALLET-1] Processing ${category} interaction: "${interaction}"`);
  
  // Create a fresh random wallet for this transaction to bypass cooldown
  const userWallet = createRandomWallet();
  console.log(`🆕 Using fresh wallet: ${userWallet.address}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get current nonce with fresh request each time
      const nonceResponse = await axios.get(`${relayerBaseUrl}/nonce/${userWallet.address}`);
      const nonce = parseInt(nonceResponse.data.nonce);
      
      console.log(`👤 User: ${userWallet.address} (Attempt ${attempt}/${maxRetries})`);
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
      const errorMessage = error.response?.data?.error || error.message;
      
      // For LOW significance interactions, rejection is expected and acceptable
      if (category === 'LOW' && (errorMessage.includes('significance below threshold') || 
                                errorMessage.includes('rejected by AI validation'))) {
        console.log(`🎯 ${category} Transaction correctly REJECTED (expected): ${errorMessage}`);
        console.log(`📊 Significance: ${error.response?.data?.significance || 'N/A'}`);
        console.log(`🚫 This is the desired behavior for low-significance interactions`);
        return { rejected: true, reason: errorMessage, expected: true };
      }
      
      // Check if it's a nonce-related error that we should retry
      const isNonceError = errorMessage.includes('nonce') || 
                          errorMessage.includes('Transaction simulation failed') ||
                          errorMessage.includes('would revert on blockchain');
      
      if (isNonceError && attempt < maxRetries) {
        console.log(`⚠️  ${category} Attempt ${attempt} failed (nonce issue): ${errorMessage}`);
        console.log(`🔄 Retrying in ${attempt * 1000}ms...`);
        await delay(attempt * 1000); // Progressive delay: 1s, 2s, 3s
        continue;
      } else {
        console.log(`❌ ${category} Transaction failed after ${attempt} attempts: ${errorMessage}`);
        
        // For HIGH/MEDIUM, failure is unexpected
        if (category !== 'LOW') {
          console.log(`⚠️  UNEXPECTED: ${category} significance interactions should be accepted!`);
        }
        
        throw error;
      }
    }
  }
}

async function runAllInteractions() {
  console.log('\n🚀 WALLET-1 MULTI-CATEGORY INTERACTION TEST');
  console.log('==========================================');
  console.log('🆕 Using random wallets for each transaction (bypasses cooldown)');
  console.log('📊 Test Plan: 10 High + 10 Medium + 10 Low interactions');
  console.log('🎯 Expected: High/Medium ACCEPTED, Low REJECTED\n');

  let successCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;
  let totalCount = 0;

  // Process High significance interactions (SHOULD BE ACCEPTED)
  console.log('\n🔴 === HIGH SIGNIFICANCE INTERACTIONS (10) === SHOULD BE ACCEPTED');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(highInteractions);
      const result = await signAndSend(interaction, 'HIGH');
      if (result.rejected) {
        console.log(`⚠️  UNEXPECTED: High significance interaction was rejected!`);
        failedCount++;
      } else {
        successCount++;
      }
      await delay(2000); // 2s delay between transactions
    } catch (error) {
      console.log(`❌ High interaction ${i + 1} failed after all retries, continuing...`);
      failedCount++;
    }
  }

  // Process Medium significance interactions (SHOULD BE ACCEPTED)
  console.log('\n🟡 === MEDIUM SIGNIFICANCE INTERACTIONS (10) === SHOULD BE ACCEPTED');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(mediumInteractions);
      const result = await signAndSend(interaction, 'MEDIUM');
      if (result.rejected) {
        console.log(`⚠️  UNEXPECTED: Medium significance interaction was rejected!`);
        failedCount++;
      } else {
        successCount++;
      }
      await delay(1800); // 1.8s delay between transactions
    } catch (error) {
      console.log(`❌ Medium interaction ${i + 1} failed after all retries, continuing...`);
      failedCount++;
    }
  }

  // Process Low significance interactions (SHOULD BE REJECTED)
  console.log('\n🟢 === LOW SIGNIFICANCE INTERACTIONS (10) === SHOULD BE REJECTED');
  for (let i = 0; i < 10; i++) {
    totalCount++;
    try {
      const interaction = getRandomFromArray(lowInteractions);
      const result = await signAndSend(interaction, 'LOW');
      if (result.rejected && result.expected) {
        console.log(`✅ Low significance interaction correctly rejected (expected behavior)`);
        rejectedCount++;
      } else {
        console.log(`⚠️  UNEXPECTED: Low significance interaction was accepted!`);
        successCount++;
      }
      await delay(1500); // 1.5s delay between transactions
    } catch (error) {
      console.log(`❌ Low interaction ${i + 1} failed unexpectedly, continuing...`);
      failedCount++;
    }
  }

  // Final summary
  console.log('\n🏁 WALLET-1 TEST COMPLETE');
  console.log('========================');
  console.log(`✅ Accepted (High/Medium): ${successCount}/${totalCount - 10} (should be 20)`);
  console.log(`🚫 Rejected (Low): ${rejectedCount}/10 (should be 10)`);
  console.log(`❌ Unexpected Failures: ${failedCount}/${totalCount}`);
  console.log(`📊 Total Processed: ${totalCount}`);
  console.log(`🎯 Expected Behavior: ${successCount === 20 && rejectedCount === 10 ? '✅ PERFECT' : '⚠️  NEEDS REVIEW'}`);
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
- Dynamic Wallets: Each transaction uses a randomly generated wallet
- Cooldown Bypass: Fresh wallets have no cooldown restrictions
- Test Plan: 10 High + 10 Medium + 10 Low significance interactions
- Expected Behavior:
  * HIGH (>6.0): Should be ACCEPTED - detailed technical content
  * MEDIUM (3.0-5.9): Should be ACCEPTED - quality contributions  
  * LOW (<0.1): Should be REJECTED - minimal interactions
- Progressive delays: 2s (high) -> 1.8s (medium) -> 1.5s (low)
- Comprehensive tracking of expected vs actual behavior
- Retry logic for nonce conflicts with exponential backoff
- Random wallet generation eliminates cooldown-related failures
*/
