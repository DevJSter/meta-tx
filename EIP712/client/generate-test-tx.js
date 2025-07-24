import { ethers } from 'ethers';
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

// Test with a different user (alternative test account)
const DIFFERENT_PRIVATE_KEY = '0x59c6995e998f97436de2d8d75b5e46c8b32b4acd5ee8a4a71a5b073e7a6b9ad0';

// Use centralized configuration values
const RPC_URL = blockchain.rpcUrl;
const RELAYER_URL = server.relayerBaseUrl;

// EIP-712 Domain and Types from centralized config
const domain = eip712.domain;
const types = eip712.types;

async function generateTestTransaction() {
  try {
    console.log('🧪 Generating test transaction from different user...');
    
    // Create wallet for different user
    const wallet = new ethers.Wallet(DIFFERENT_PRIVATE_KEY);
    console.log('👤 Different User Address:', wallet.address);
    
    // Get current nonce
    const nonceResponse = await fetch(`${RELAYER_URL}/nonce/${wallet.address}`);
    const nonceData = await nonceResponse.json();
    const nonce = parseInt(nonceData.nonce);
    
    console.log('📊 Current nonce:', nonce);
    
    // Different test interactions with varying significance levels
    const testInteractions = [
      // High significance - educational content
      'I really appreciate this detailed analysis of auditing firms. This post provides valuable insights into how blockchain auditing works and helps the community understand security best practices. Thank you for sharing your expertise!',
      
      // Medium significance - quality comment
      'Great point about the importance of smart contract audits. I\'ve seen too many projects fail because they skipped this crucial step.',
      
      // Basic significance - simple reaction
      'This is really helpful, thanks for sharing!',
      
      // Low significance - should be rejected
      'post_id-123_spam_content'
    ];
    
    // Use the first (high significance) interaction by default
    // You can change the index to test different interactions
    const interaction = testInteractions[0];
    console.log('💬 Testing interaction:', interaction.substring(0, 100) + (interaction.length > 100 ? '...' : ''));
    
    // Sign the meta-transaction
    const message = {
      user: wallet.address,
      interaction: interaction,
      nonce: nonce
    };
    
    console.log('📝 Signing message:', message);
    
    const signature = await wallet.signTypedData(domain, types, message);
    console.log('✅ Signature created');
    
    // Submit to relayer
    const response = await fetch(`${RELAYER_URL}/relayMetaTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: wallet.address,
        interaction: interaction,
        nonce: nonce,
        signature: signature
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Transaction successful!');
      console.log('📄 Transaction Hash:', result.txHash);
      console.log('🏷️  Category:', result.validation.category);
      console.log('📊 Significance:', result.validation.significance);
      console.log('🤖 Confidence:', result.validation.confidence);
      console.log('� Gas Used:', result.gasUsed);
      console.log('');
      console.log('�🔍 Now run: node verify-signer.js');
      console.log('   to see this transaction in the list!');
    } else {
      console.error('❌ Transaction failed:', result.error);
      if (result.reason) {
        console.error('📝 Reason:', result.reason);
      }
      if (result.confidence) {
        console.error('🤖 AI Confidence:', result.confidence);
      }
      if (result.suggestion) {
        console.error('💡 Suggestion:', result.suggestion);
      }
      
      console.log('');
      console.log('💡 Try editing the interaction in this file to test different content:');
      console.log('   - Change testInteractions[0] to testInteractions[1], [2], or [3]');
      console.log('   - Or modify the interaction text directly');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateTestTransaction().catch(console.error);
