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
  'write_article-advanced_solidity_gas_optimization_techniques_comprehensive_guide_for_enterprise_smart_contracts',
  'create_post-ethereum_virtual_machine_deep_dive_opcodes_execution_environment_and_state_transitions',
  'write_article-zero_knowledge_proofs_zk_snarks_implementation_privacy_preserving_blockchain_applications',
  'create_post-mev_maximum_extractable_value_protection_strategies_for_defi_protocol_developers',
  'write_article-decentralized_storage_solutions_ipfs_arweave_filecoin_comparative_analysis_and_use_cases',
  'create_post-consensus_algorithm_performance_analysis_proof_of_stake_validator_economics_and_security',
  'write_article-blockchain_governance_models_research_decentralized_autonomous_organizations_and_token_voting',
  'create_post-layer3_application_specific_blockchains_custom_execution_environments_and_specialized_consensus',
  'write_article-quantum_resistant_cryptography_for_blockchain_post_quantum_security_and_future_proofing',
  'create_post-automated_market_maker_liquidity_optimization_impermanent_loss_mitigation_strategies'
];

// Medium significance interactions (Expected: 3.0-5.9 - should be ACCEPTED)
const mediumInteractions = [
  'comment_post-detailed_technical_review_of_ethereum_london_hard_fork_eip1559_fee_mechanism_analysis',
  'share_post-critical_security_patch_announcement_for_popular_defi_lending_protocol_community_awareness',
  'comment_post-constructive_feedback_on_dao_governance_whitepaper_voting_mechanisms_and_token_economics',
  'join_community-layer2_protocol_developers_dao_contributing_to_optimistic_rollup_development',
  'follow_user-experienced_defi_yield_farming_strategist_specializing_in_liquidity_mining_optimization',
  'comment_post-thorough_technical_analysis_of_gas_optimization_patterns_in_solidity_smart_contracts',
  'share_post-comprehensive_smart_contract_audit_report_findings_security_vulnerabilities_and_fixes',
  'comment_post-valuable_insights_on_tokenomics_design_inflation_deflation_mechanisms_and_utility',
  'join_community-nft_creators_collaborative_space_for_digital_art_and_blockchain_technology',
  'follow_user-blockchain_infrastructure_engineer_with_expertise_in_node_operations_and_networking'
];

// Low significance interactions (Expected: <0.1 - should be REJECTED)
const lowInteractions = [
  'like_post-77777',
  'react_post-🚀',
  'bookmark_post-cool',
  'vote_poll-b',
  'like_post-nice',
  'react_post-👌',
  'bookmark_post-read',
  'vote_poll-no',
  'like_post-good',
  'react_post-💯'
];

// Utility functions
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function signAndSend(interaction, category, maxRetries = 3) {
  console.log(`\n📝 [WALLET-2] Processing ${category} interaction: "${interaction}"`);
  
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
  console.log('\n🚀 WALLET-2 MULTI-CATEGORY INTERACTION TEST');
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
      await delay(2100); // 2.1s delay between transactions (staggered from wallet1)
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
      await delay(1900); // 1.9s delay between transactions (staggered from wallet1)
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
      await delay(1600); // 1.6s delay between transactions (staggered from wallet1)
    } catch (error) {
      console.log(`❌ Low interaction ${i + 1} failed unexpectedly, continuing...`);
      failedCount++;
    }
  }

  // Final summary
  console.log('\n🏁 WALLET-2 TEST COMPLETE');
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
WALLET-2 TEST CONFIGURATION:
- Dynamic Wallets: Each transaction uses a randomly generated wallet
- Cooldown Bypass: Fresh wallets have no cooldown restrictions
- Test Plan: 10 High + 10 Medium + 10 Low significance interactions
- Different interaction sets from wallet1 for variety
- Progressive delays: 1.6s (high) -> 1.3s (medium) -> 1.1s (low)
- Comprehensive success/failure tracking and reporting
- Random wallet generation eliminates cooldown-related failures
*/
