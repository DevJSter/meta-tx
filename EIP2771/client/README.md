# EIP-2771 Client - Meta-Transaction Signer

## Overview

This client demonstrates how to sign and submit EIP-2771 meta-transactions to an AI-validated forwarder. It showcases gasless transactions where users sign meta-transactions that are executed by a relayer with AI content validation.

## How It Works

1. **User Signs Meta-Transaction**: Using EIP-712 structured data signing
2. **Submits to AI Service**: Sends signed meta-tx to AI validation service
3. **AI Validates Content**: Ollama LLM analyzes interaction content
4. **Executes if Approved**: AI service relays to forwarder contract if valid

## Quick Start

### Prerequisites

1. **Deployed Contracts**: EIP-2771 forwarder and recipient contracts
2. **AI Service Running**: Ollama AI validation service on port 3001
3. **Blockchain Access**: RPC connection to your target network

### Installation

```bash
# Install dependencies
npm install
```

### Configuration

Update the configuration variables in `signer.js`:

```javascript
// Network Configuration
const RPC_URL = 'http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc';
const CHAIN_ID = 930393;

// Contract Addresses (update with your deployed contracts)
const FORWARDER_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const RECIPIENT_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

// AI Service
const AI_SERVICE_URL = 'http://localhost:3001';

// User Private Key (use a test account)
const USER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
```

### Run the Client

```bash
# Start the client
npm start
# or
node signer.js
```

## 🧪 What the Client Tests

The client tests various interactions to demonstrate AI validation:

### Approved Interactions
```javascript
'liked_post_12345'        // Social engagement
'comment_great_article'   // Constructive feedback  
'share_awesome_content'   // Content sharing
```

### Rejected Interactions
```javascript
'spam_everyone_now'       // Spam content
'hack_the_system'         // Potentially malicious
```

## Expected Output

```bash
EIP-2771 Ollama AI Meta-Transaction Client Started
==================================================
User address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
AI Service: http://localhost:3001

🧪 Testing interaction: "liked_post_12345"
==================================================

=== Testing AI Validation ===
🤖 AI Test Result: {
  interaction: 'liked_post_12345',
  aiResult: {
    approved: true,
    significance: 1,
    reasoning: 'Positive social interaction',
    category: 'positive'
  },
  decision: { decision: 'APPROVED', reasoning: 'High confidence approval (1)' }
}

=== User Interactions Check ===
User 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 has 0 interactions

=== Signing Meta-Transaction ===
User nonce: 0
Meta-transaction request: {
  from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  to: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  interaction: 'liked_post_12345',
  nonce: '0',
  deadline: 1751900000
}
Signature: 0x1234...

=== Submitting to AI Validation Service ===
Sending request to AI service...
AI Service Response: {
  txHash: '0x5678...',
  blockNumber: 42,
  gasUsed: '85000',
  aiResult: { approved: true, significance: 1 },
  decision: { decision: 'APPROVED' },
  interaction: 'liked_post_12345'
}

Success! Transaction: 0x5678...
AI Decision: APPROVED
Significance: 1
Reasoning: Positive social interaction
```

## Key Functions

### `signMetaTransaction()`
Creates and signs an EIP-712 meta-transaction:

```javascript
async function signMetaTransaction(userWallet, forwarderContract, recipientAddress, interaction) {
    // Get user's nonce
    const nonce = await forwarderContract.nonces(userWallet.address);
    
    // Encode function call
    const data = recipientInterface.encodeFunctionData('executeInteraction', [interaction]);
    
    // Create ForwardRequest
    const request = {
        from: userWallet.address,
        to: recipientAddress,
        value: 0,
        gas: 100000,
        nonce: Number(nonce),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        data: data
    };
    
    // Sign using EIP-712
    const signature = await userWallet.signTypedData(domain, types, request);
    
    return { request: { ...request, signature }, signature };
}
```

### `submitToAIService()`
Submits the signed meta-transaction to the AI validation service:

```javascript
async function submitToAIService(request) {
    const response = await axios.post(`${AI_SERVICE_URL}/validateAndRelay`, {
        request: request
    });
    
    return response.data;
}
```

### `testAIValidation()`
Tests AI validation without executing a transaction:

```javascript
async function testAIValidation(interaction) {
    const response = await axios.post(`${AI_SERVICE_URL}/testValidation`, {
        interaction: interaction
    });
    
    return response.data;
}
```

## EIP-712 Structure

The client uses EIP-712 to sign ForwardRequest structures:

```javascript
const domain = {
    name: 'QoneqtAIForwarder',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: FORWARDER_ADDRESS
};

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
```

## Troubleshooting

### Common Issues

1. **"Network Error: Do not know how to serialize a BigInt"**
   ```javascript
   // Ensure nonce is converted to Number
   nonce: Number(nonce)  // Correct
   nonce: nonce         // BigInt serialization error
   ```

2. **"Invalid signature" error**
   ```bash
   # Check domain parameters match deployed contract
   # Verify chainId is correct
   # Ensure contract addresses are updated
   ```

3. **"AI Service not responding"**
   ```bash
   # Check AI service is running
   curl http://localhost:3001/health
   
   # Verify Ollama is running
   ollama list
   ```

4. **"Contract not found"**
   ```bash
   # Update contract addresses after deployment
   # Verify RPC connection
   # Check network configuration
   ```

## Customization

### Add New Test Interactions

```javascript
const testInteractions = [
    'liked_post_12345',
    'comment_great_article',
    'your_custom_interaction',  // Add here
    'spam_everyone_now'
];
```

### Modify AI Service URL

```javascript
const AI_SERVICE_URL = 'http://your-ai-service:3001';
```

### Change Network

```javascript
const RPC_URL = 'https://your-network-rpc.com';
const CHAIN_ID = 12345;
```

## Next Steps

1. **Frontend Integration**: Use this client logic in a React/Vue app
2. **Wallet Integration**: Connect MetaMask or other wallets
3. **Error Handling**: Add comprehensive error handling
4. **Batch Transactions**: Support multiple meta-transactions
5. **UI Components**: Build user-friendly interfaces

## 📚 Dependencies

- **ethers**: Ethereum library for signing and blockchain interaction
- **axios**: HTTP client for API calls

## 🔗 Related Files

- `../ollama-ai-service.js`: AI validation service
- `../src/AIValidatedForwarder.sol`: Forwarder contract
- `../src/MetaTxInteractionRecipient.sol`: Target contract

This client demonstrates the power of **gasless transactions with AI validation** - providing seamless user experience while ensuring content quality! 🚀
