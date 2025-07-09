# AI-Validated Meta-Transaction System

This project demonstrates two different approaches to meta-transactions with AI validation on Ethereum-compatible blockchains. It showcases both **EIP-712** (direct signature validation) and **EIP-2771** (forwarder-based) implementations, each with their unique advantages.

## Quick Start

**One-line setup for everything:**

```bash
chmod +x setup.sh && ./setup.sh
```

This interactive script will guide you through setting up either or both implementations.

## Architecture Overview

![AI-Validated Meta-Transaction Architecture](./architecture.png)

*Diagram: High-level architecture showing the interaction between Client, AI Service, and Smart Contracts.*

## Two Implementations Available

### 1. EIP-712 Implementation (`EIP712/`)
Direct signature validation approach:
- **Simple & Efficient**: Direct signature verification in contract
- **Lower Gas Costs**: Minimal overhead
- **Basic AI Validation**: Relayer with AI content checking
- **Great for**: Simple meta-transaction needs

### 2. EIP-2771 Implementation (`EIP2771/`)
Standard-compliant forwarder approach:
- **Advanced AI Validation**: Sophisticated content moderation using Ollama
- **Standard Compliant**: Full EIP-2771 implementation
- **Highly Composable**: Works with any ERC2771Context contract
- **Rich Features**: Significance scoring, validation controls, owner management
- **Great for**: Production systems requiring advanced validation

## Features

### Common Features
- **Gasless Transactions**: Users don't need ETH for gas fees
- **AI Validation**: Transactions validated by AI before execution
- **Nonce Management**: Prevents replay attacks
- **Secure Signatures**: EIP-712 structured data signing

### EIP-2771 Exclusive Features
- **Ollama Integration**: Local LLM for content moderation
- **Significance Scoring**: Automatic transaction importance assessment
- **Advanced Controls**: Owner/validator permissions, thresholds
- **Standard Compliance**: Full EIP-2771 forwarder pattern

## Project Structure

```
new-ai-validator/
├── setup.sh                     # Main setup script
├── DIFFERENCE.md                 # Implementation comparison
├── EIP712/                      # EIP-712 Implementation
│   ├── setup.sh                 # Automated setup for EIP-712
│   ├── contracts/
│   │   ├── src/EIPMetaTx.sol    # Direct signature meta-tx contract
│   │   └── script/EIPMeta.s.sol # Deployment script
│   ├── client/signer.js         # EIP-712 signing client
│   ├── relayer/
│   │   ├── index.js             # Basic relayer service
│   │   └── ollama-relayer.js    # AI validation relayer
│   └── README.md                # EIP-712 documentation
├── EIP2771/                     # EIP-2771 Implementation
│   ├── setup.sh                 # Automated setup for EIP-2771
│   ├── src/
│   │   ├── AIValidatedForwarder.sol      # AI-powered forwarder
│   │   └── MetaTxInteractionRecipient.sol # Recipient contract
│   ├── ollama-ai-service.js     # AI validation service
│   ├── client/signer.js         # EIP-2771 client
│   └── README.md                # EIP-2771 documentation
├── client/                      # Legacy EIP-712 Client
│   └── README.md                # Legacy client documentation
└── relayer/                     # Legacy EIP-712 Relayer
    └── README.md                # Legacy relayer documentation
```

## Prerequisites

Before running the setup scripts, ensure you have:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Foundry** (latest version) - [Installation guide](https://book.getfoundry.sh/getting-started/installation)
- **Ollama** (for AI validation) - [Download here](https://ollama.ai/)

## Installation & Setup

### Option 1: Interactive Setup (Recommended)

Run the main setup script and choose your implementation:

```bash
./setup.sh
```

This will guide you through:
1. Choosing between EIP-712 and EIP-2771 (or both)
2. Installing all dependencies
3. Deploying contracts to your chosen network
4. Configuring all services
5. Providing next steps to run the system

### Option 2: Manual Setup

#### For EIP-712 Implementation:
```bash
cd EIP712/
./setup.sh
```

#### For EIP-2771 Implementation:
```bash
cd EIP2771/
./setup.sh
```

### Configuration Options

Both setup scripts accept environment variables for configuration:

```bash
# Network configuration
export RPC_URL="http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc"
export CHAIN_ID="930393"
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# AI configuration
export OLLAMA_MODEL="llama3.2:latest"

# Run setup with custom configuration
./setup.sh
```

## Running the System

After setup, follow these steps based on your chosen implementation:

### EIP-712 Implementation

```bash
# Terminal 1: Start the relayer
cd EIP712/relayer/
node ollama-relayer.js

# Terminal 2: Run the client
cd EIP712/client/
node signer.js
```

### EIP-2771 Implementation

```bash
# Terminal 1: Start the AI service
cd EIP2771/
node ollama-ai-service.js

# Terminal 2: Run the client
cd EIP2771/client/
node signer.js
```

## How It Works

### EIP-712 Flow (Direct Signatures)
1. **Client Signs**: Creates EIP-712 signature for meta-transaction
2. **Relayer Validates**: Basic AI validation and submits to contract
3. **Contract Executes**: Verifies signature and executes transaction

### EIP-2771 Flow (Forwarder Pattern)
1. **Client Signs**: Creates EIP-2771 compliant meta-transaction
2. **AI Service Validates**: Advanced validation using Ollama LLM
3. **Forwarder Submits**: AI-validated forwarder submits to recipient
4. **Recipient Executes**: ERC2771Context recipient executes transaction

### AI Validation Features

#### EIP-712 (Basic)
- Simple content filtering
- Basic approval/rejection logic
- Lightweight validation

#### EIP-2771 (Advanced)
- **Ollama Integration**: Local LLM analysis
- **Content Moderation**: Sophisticated language understanding
- **Significance Scoring**: Automatic importance assessment
- **Threshold Controls**: Configurable validation levels
- **Owner Controls**: Admin override capabilities

## 🧪 Testing & Development

### Health Checks

Verify all services are running:

```bash
# Ollama API
curl http://localhost:11434/api/tags

# EIP-712 Relayer
curl http://localhost:3000/health

# EIP-2771 AI Service  
curl http://localhost:3001/health

# Blockchain RPC
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc
```

### Run Contract Tests

```bash
# EIP-712 tests
cd EIP712/contracts/
forge test -v

# EIP-2771 tests
cd EIP2771/
forge test -v
```

### Example Interactions

Both implementations support various interaction types:

```javascript
// Social media interactions
"liked_post_123"
"comment_on_post_456" 
"shared_article_789"

// E-commerce interactions
"purchased_item_abc"
"reviewed_product_xyz"
"added_to_wishlist_def"
```

The EIP-2771 implementation provides detailed AI analysis of interaction content and intent.

## Troubleshooting

### Common Issues

1. **"Invalid signature" error**: 
   - Check that the user private key matches the address
   - Verify the EIP-712 domain parameters match between client and contract

2. **"Contract not found" error**:
## Troubleshooting

### Common Issues

#### 1. Setup Script Fails
```bash
# Check prerequisites
node --version    # Should be v18+
forge --version   # Should be latest
ollama --version  # Should be installed

# Re-run with verbose output
bash -x ./setup.sh
```

#### 2. Contract Deployment Issues
```bash
# Check blockchain connectivity
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  $RPC_URL

# Verify account has funds
cast balance $DEPLOYER_ADDRESS --rpc-url $RPC_URL
```

#### 3. AI Service Connection Issues
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama if needed
ollama serve

# Pull required model
ollama pull llama3.2:latest
```

#### 4. Signature Validation Errors
- **EIP-712**: Check domain parameters match between client and contract
- **EIP-2771**: Verify forwarder address is trusted by recipient

#### 5. Transaction Rejections
- **EIP-712**: Basic filter - try "liked_post" or "comment_here"
- **EIP-2771**: AI analysis - use meaningful, appropriate content

### Debug Commands

```bash
# Check contract addresses
cat EIP712/contracts/.contract_address    # EIP-712
cat EIP2771/.forwarder_address            # EIP-2771 forwarder
cat EIP2771/.recipient_address            # EIP-2771 recipient

# View recent transactions
cast logs --from-block latest --address $CONTRACT_ADDRESS --rpc-url $RPC_URL

# Check user nonces
cast call $CONTRACT_ADDRESS "nonces(address)(uint256)" $USER_ADDRESS --rpc-url $RPC_URL
```

## Implementation Comparison

| Feature | EIP-712 | EIP-2771 |
|---------|---------|----------|
| **Setup Complexity** | Simple | Moderate |
| **Gas Costs** | Lower | Higher |
| **AI Validation** | Basic filtering | Advanced LLM analysis |
| **Standard Compliance** | Custom | EIP-2771 compliant |
| **Composability** | Limited | High |
| **Production Ready** | Demo | Near-production |

For detailed comparison, see [`DIFFERENCE.md`](./DIFFERENCE.md).

## Documentation

- **[EIP-712 Guide](EIP712/README.md)**: Detailed EIP-712 setup and usage
- **[EIP-2771 Guide](EIP2771/README.md)**: Comprehensive EIP-2771 documentation  
- **[Implementation Comparison](DIFFERENCE.md)**: Side-by-side feature comparison
- **[Legacy Client Documentation](client/README.md)**: Legacy EIP-712 client
- **[Legacy Relayer Documentation](relayer/README.md)**: Legacy EIP-712 relayer

## Next Steps

### Immediate Improvements
1. **Enhanced AI Models**: Integrate GPT-4, Claude, or specialized content models
2. **Rate Limiting**: Implement proper DoS protection
3. **Monitoring**: Add comprehensive logging and metrics
4. **Error Handling**: Improve error messages and recovery

### Production Enhancements  
1. **Web Interface**: Build React/Vue frontend
2. **Wallet Integration**: Support MetaMask, WalletConnect
3. **Multi-chain**: Deploy to Polygon, Arbitrum, Optimism
4. **Analytics**: Transaction volume, validation rates, user patterns

### Advanced Features
1. **Batch Transactions**: Process multiple meta-transactions
2. **Dynamic Pricing**: AI-based gas price optimization
3. **Machine Learning**: Adaptive validation thresholds
4. **Cross-chain**: Enable meta-transactions across networks

## Security Considerations

**Important**: This is a demonstration project. For production use:

- **Key Management**: Use secure key storage (HSM, KMS)
- **Private Networks**: Don't expose private keys in code
- **Rate Limiting**: Implement comprehensive DoS protection  
- **Security Audits**: Conduct thorough smart contract audits
- **Monitoring**: Add real-time security monitoring
- **Access Controls**: Implement proper authentication/authorization

## Contributing

Contributions welcome! Areas of interest:

- AI model improvements and new providers
- Gas optimization techniques
- Security enhancements
- Documentation improvements
- Frontend implementations
- Testing and QA

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Happy meta-transacting!**

*Built with love for the Ethereum community*
