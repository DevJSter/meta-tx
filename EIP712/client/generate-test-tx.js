import { ethers } from 'ethers';

// Test with a different user
const DIFFERENT_PRIVATE_KEY = '0x59c6995e998f97436de2d8d75b5e46c8b32b4acd5ee8a4a71a5b073e7a6b9ad0'; // Different test account
const RPC_URL = 'https://subnets.avax.network/thane/testnet/rpc';
const RELAYER_URL = 'http://localhost:3001';

// EIP-712 Domain and Types
const domain = {
  name: 'MetaTxInteraction',
  version: '1',
  chainId: 202102,
  verifyingContract: '0x59b670e9fA9D0A427751Af201D676719a970857b'
};

const types = {
  MetaTx: [
    { name: 'user', type: 'address' },
    { name: 'interaction', type: 'string' },
    { name: 'nonce', type: 'uint256' }
  ]
};

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
    
    // Create interaction data
    const interaction = 'comment_reply-insightful_defi_analysis';
    
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
      console.log('');
      console.log('🔍 Now run: node verify-signer.js');
      console.log('   to see this transaction in the list!');
    } else {
      console.error('❌ Transaction failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateTestTransaction().catch(console.error);
