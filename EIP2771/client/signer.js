const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const RPC_URL = 'http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc';
const CHAIN_ID = 930393;

// Replace these with your deployed contract addresses
const FORWARDER_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const RECIPIENT_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

// AI Service URL
const AI_SERVICE_URL = 'http://localhost:3001';

// Replace with actual private keys (use different accounts)
const USER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Second Anvil account

// EIP-712 Domain for the forwarder
const domain = {
    name: 'QoneqtAIForwarder',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: FORWARDER_ADDRESS
};

// EIP-712 Type definitions for ForwardRequest
const types = {
    ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint48' },
        { name: 'data', type: 'bytes' }
    ]
};

// Contract ABIs (simplified)
const forwarderABI = [
    'function nonces(address owner) external view returns (uint256)',
    'function validateInteractionBasic(string memory interaction) external view returns (bool)'
];

const recipientABI = [
    'function executeInteraction(string memory interaction) external',
    'function getUserInteractionCount(address user) external view returns (uint256)',
    'function getLatestInteraction(address user) external view returns (string)',
    'function isMetaTransaction() external view returns (bool)'
];

async function signMetaTransaction(userWallet, forwarderContract, recipientAddress, interaction) {
    console.log('\\n=== Signing Meta-Transaction ===');
    
    // Get user's nonce from the forwarder
    const nonce = await forwarderContract.nonces(userWallet.address);
    console.log(`User nonce: ${nonce}`);
    
    // Encode the function call
    const recipientInterface = new ethers.Interface(recipientABI);
    const data = recipientInterface.encodeFunctionData('executeInteraction', [interaction]);
    
    // Create the meta-transaction request
    const request = {
        from: userWallet.address,
        to: recipientAddress,
        value: 0,
        gas: 100000,
        nonce: Number(nonce), // Convert BigInt to Number
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        data: data
    };
    
    console.log('Meta-transaction request:', {
        from: request.from,
        to: request.to,
        interaction: interaction,
        nonce: request.nonce.toString(),
        deadline: request.deadline
    });
    
    // Sign the meta-transaction using EIP-712
    const signature = await userWallet.signTypedData(domain, types, request);
    console.log(`Signature: ${signature}`);
    
    return { request: { ...request, signature }, signature };
}

async function submitToAIService(request) {
    console.log('\\n=== Submitting to AI Validation Service ===');
    
    try {
        console.log('📡 Sending request to AI service...');
        const response = await axios.post(`${AI_SERVICE_URL}/validateAndRelay`, {
            request: request
        });
        
        console.log('✅ AI Service Response:', response.data);
        return response.data;
        
    } catch (error) {
        if (error.response) {
            console.error('❌ AI Service Error:', error.response.data);
            throw new Error(`AI Validation failed: ${error.response.data.error}`);
        } else {
            console.error('❌ Network Error:', error.message);
            throw new Error(`Network error: ${error.message}`);
        }
    }
}

async function checkUserInteractions(recipientContract, userAddress) {
    console.log('\\n=== User Interactions Check ===');
    
    try {
        const count = await recipientContract.getUserInteractionCount(userAddress);
        console.log(`User ${userAddress} has ${count} interactions`);
        
        if (count > 0) {
            const latest = await recipientContract.getLatestInteraction(userAddress);
            console.log(`Latest interaction: ${latest}`);
        }
        
        return count;
    } catch (error) {
        console.error('Error checking user interactions:', error.message);
        return 0;
    }
}

async function testAIValidation(interaction) {
    console.log('\\n=== Testing AI Validation ===');
    
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/testValidation`, {
            interaction: interaction
        });
        
        console.log('🤖 AI Test Result:', response.data);
        return response.data;
        
    } catch (error) {
        console.error('Error testing AI validation:', error.message);
        return null;
    }
}

async function main() {
    console.log('🚀 EIP-2771 Ollama AI Meta-Transaction Client Started');
    console.log('==================================================');
    
    // Setup provider and wallets
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const userWallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    
    console.log(`User address: ${userWallet.address}`);
    console.log(`AI Service: ${AI_SERVICE_URL}`);
    
    // Connect to contracts
    const forwarderContract = new ethers.Contract(FORWARDER_ADDRESS, forwarderABI, provider);
    const recipientContract = new ethers.Contract(RECIPIENT_ADDRESS, recipientABI, provider);
    
    // Test different interactions
    const testInteractions = [
        'liked_post_12345',
        'comment_great_article',
        'share_awesome_content',
        'spam_everyone_now',  // Should be rejected
        'hack_the_system'     // Should be rejected
    ];
    
    for (const interaction of testInteractions) {
        try {
            console.log(`\\n🧪 Testing interaction: "${interaction}"`);
            console.log('='.repeat(50));
            
            // 1. Test AI validation first
            await testAIValidation(interaction);
            
            // 2. Check user's current interactions
            await checkUserInteractions(recipientContract, userWallet.address);
            
            // 3. Sign meta-transaction
            const { request } = await signMetaTransaction(
                userWallet, 
                forwarderContract, 
                RECIPIENT_ADDRESS, 
                interaction
            );
            
            // 4. Submit to AI service for validation and execution
            const result = await submitToAIService(request);
            
            console.log(`\\n🎉 Success! Transaction: ${result.txHash}`);
            console.log(`📊 AI Decision: ${result.decision.decision}`);
            console.log(`🎯 Significance: ${result.aiResult.significance}`);
            console.log(`💭 Reasoning: ${result.aiResult.reasoning}`);
            
            // 5. Check updated interactions
            console.log('\\n=== Post-Transaction State ===');
            await checkUserInteractions(recipientContract, userWallet.address);
            
        } catch (error) {
            console.error(`\\n❌ Failed for "${interaction}":`, error.message);
        }
        
        // Wait a bit between transactions
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\\n✅ All tests completed!');
}

// Export functions for reuse
module.exports = {
    signMetaTransaction,
    submitToAIService,
    testAIValidation,
    checkUserInteractions
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
