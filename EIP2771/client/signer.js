const { ethers } = require('ethers');

// Configuration
const RPC_URL = 'http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc';
const CHAIN_ID = 930393;

// Replace these with your deployed contract addresses
const FORWARDER_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const RECIPIENT_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

// Replace with actual private keys (use different accounts)
const USER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Second Anvil account
const RELAYER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // First Anvil account

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
    'function execute((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature)) external payable',
    'function executeWithValidation((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature)) external payable',
    'function verify((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature)) external view returns (bool)',
    'function validateInteraction(string memory interaction) external view returns (bool)'
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
        nonce: nonce,
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
    
    return { request, signature };
}

async function submitMetaTransaction(relayerWallet, forwarderContract, request, signature) {
    console.log('\\n=== Submitting Meta-Transaction ===');
    
    // Create the full request with signature
    const fullRequest = {
        from: request.from,
        to: request.to,
        value: request.value,
        gas: request.gas,
        deadline: request.deadline,
        data: request.data,
        signature: signature
    };
    
    try {
        // First, verify the signature is valid
        const isValidSignature = await forwarderContract.verify(fullRequest);
        console.log(`Signature validation: ${isValidSignature}`);
        
        if (!isValidSignature) {
            throw new Error('Invalid signature');
        }
        
        // Submit the meta-transaction using regular execute (bypassing AI validation for now)
        console.log('Submitting meta-transaction...');
        const tx = await forwarderContract.connect(relayerWallet).execute(fullRequest);
        console.log(`Transaction hash: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed}`);
        
        return receipt;
        
    } catch (error) {
        console.error('Error submitting meta-transaction:', error.message);
        throw error;
    }
}

async function checkInteractionValidation(forwarderContract, interaction) {
    console.log('\\n=== AI Validation Check ===');
    
    try {
        const isValid = await forwarderContract.validateInteraction(interaction);
        console.log(`Interaction "${interaction}" is ${isValid ? 'VALID' : 'INVALID'} according to AI rules`);
        return isValid;
    } catch (error) {
        console.error('Error checking validation:', error.message);
        return false;
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

async function main() {
    console.log('🚀 EIP-2771 Meta-Transaction Client Started');
    console.log('=========================================');
    
    // Setup provider and wallets
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const userWallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    
    console.log(`User address: ${userWallet.address}`);
    console.log(`Relayer address: ${relayerWallet.address}`);
    
    // Connect to contracts
    const forwarderContract = new ethers.Contract(FORWARDER_ADDRESS, forwarderABI, provider);
    const recipientContract = new ethers.Contract(RECIPIENT_ADDRESS, recipientABI, provider);
    
    // Test interaction - let's try the original one
    const interaction = 'liked_post_12345';
    
    try {
        // 1. Check AI validation
        const isValidInteraction = await checkInteractionValidation(forwarderContract, interaction);
        
        if (!isValidInteraction) {
            console.log('❌ Interaction rejected by AI validation. Exiting.');
            return;
        }
        
        // 2. Check user's current interactions
        await checkUserInteractions(recipientContract, userWallet.address);
        
        // 3. Sign meta-transaction
        const { request, signature } = await signMetaTransaction(
            userWallet, 
            forwarderContract, 
            RECIPIENT_ADDRESS, 
            interaction
        );
        
        // 4. Submit meta-transaction via relayer
        const receipt = await submitMetaTransaction(relayerWallet, forwarderContract, request, signature);
        
        // 5. Check updated interactions
        console.log('\\n=== Post-Transaction State ===');
        await checkUserInteractions(recipientContract, userWallet.address);
        
        console.log('\\n✅ Meta-transaction completed successfully!');
        
    } catch (error) {
        console.error('\\n❌ Error:', error.message);
    }
}

// Handle different interaction types for testing
async function testDifferentInteractions() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const forwarderContract = new ethers.Contract(FORWARDER_ADDRESS, forwarderABI, provider);
    
    const testInteractions = [
        'liked_post_123',
        'comment_great_article',
        'share_news_item',
        'follow_user_456',
        'spam_everyone',  // This should be rejected
        'invalid_action'  // This should be rejected
    ];
    
    console.log('\\n🧪 Testing Different Interactions');
    console.log('=================================');
    
    for (const interaction of testInteractions) {
        await checkInteractionValidation(forwarderContract, interaction);
    }
}

// Export functions for reuse
module.exports = {
    signMetaTransaction,
    submitMetaTransaction,
    checkInteractionValidation,
    testDifferentInteractions
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
