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
  'create_post-comprehensive_web3_security_framework_threat_modeling_vulnerability_assessment_best_practices',
  'write_article-cross_chain_asset_bridge_protocols_security_analysis_atomic_swaps_and_trust_minimization',
  'create_post-decentralized_identity_management_systems_self_sovereign_identity_and_privacy_preservation',
  'write_article-scalable_blockchain_consensus_mechanisms_sharding_proof_of_stake_and_validator_economics',
  'create_post-smart_contract_formal_verification_methods_mathematical_proofs_and_security_guarantees',
  'write_article-institutional_defi_adoption_strategies_regulatory_compliance_and_risk_management_frameworks',
  'create_post-blockchain_carbon_footprint_optimization_sustainable_consensus_and_green_mining_solutions',
  'write_article-privacy_preserving_transaction_protocols_zero_knowledge_proofs_and_confidential_computing',
  'create_post-dao_treasury_management_best_practices_multi_signature_wallets_and_governance_frameworks',
  'write_article-next_generation_blockchain_infrastructure_interoperability_scalability_and_composability'
];

// Medium significance interactions (Expected: 3.0-5.9 - should be ACCEPTED)
const mediumInteractions = [
  'comment_post-comprehensive_market_analysis_response_defi_trends_yield_farming_and_liquidity_dynamics',
  'share_post-important_regulatory_compliance_update_sec_guidance_for_decentralized_finance_protocols',
  'comment_post-technical_improvement_proposal_feedback_ethereum_eip_analysis_and_implementation_thoughts',
  'join_community-web3_user_experience_designers_guild_improving_decentralized_application_interfaces',
  'follow_user-blockchain_economist_researcher_specializing_in_tokenomics_and_mechanism_design',
  'comment_post-insightful_tokenomics_model_discussion_inflation_deflationary_mechanics_and_utility_design',
  'share_post-innovative_scaling_solution_announcement_layer2_rollup_technology_and_ethereum_integration',
  'comment_post-detailed_protocol_comparison_analysis_uniswap_vs_sushiswap_automated_market_makers',
  'join_community-sustainable_blockchain_initiatives_carbon_neutral_consensus_and_environmental_impact',
  'follow_user-decentralized_governance_expert_with_expertise_in_dao_voting_mechanisms_and_proposals'
];

// Low significance interactions (Expected: <0.1 - should be REJECTED)
const lowInteractions = [
  'like_post-80808',
  'react_post-⭐',
  'bookmark_post-info',
  'vote_poll-c',
  'like_post-ok',
  'react_post-✨',
  'bookmark_post-check',
  'vote_poll-maybe',
  'like_post-seen',
  'react_post-🏆'
];

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function signAndSend(interaction, category, maxRetries = 3) {
  console.log(`\n📝 [WALLET-3] Processing ${category} interaction: "${interaction}"`);
  
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
  console.log('\n🚀 WALLET-3 MULTI-CATEGORY INTERACTION TEST');
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
      await delay(2200); // 2.2s delay between transactions (staggered from other wallets)
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
      await delay(2000); // 2.0s delay between transactions (staggered from other wallets)
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
      await delay(1700); // 1.7s delay between transactions (staggered from other wallets)
    } catch (error) {
      console.log(`❌ Low interaction ${i + 1} failed unexpectedly, continuing...`);
      failedCount++;
    }
  }

  // Final summary
  console.log('\n🏁 WALLET-3 TEST COMPLETE');
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
WALLET-3 TEST CONFIGURATION:
- Dynamic Wallets: Each transaction uses a randomly generated wallet
- Cooldown Bypass: Fresh wallets have no cooldown restrictions
- Test Plan: 10 High + 10 Medium + 10 Low significance interactions
- Unique interaction sets different from wallet1 & wallet2
- Progressive delays: 1.7s (high) -> 1.4s (medium) -> 0.9s (low)
- Comprehensive success/failure tracking and reporting
- Random wallet generation eliminates cooldown-related failures
*/
