# EIP-712 Meta-Transaction Implementation

## Overview

This implementation demonstrates a **direct EIP-712 signature validation** approach for gasless meta-transactions. It provides a simpler alternative to the EIP-2771 forwarder pattern, with direct signature verification in the contract.

## Key Features

- **Direct Signature Validation**: No forwarder contracts needed
- **EIP-712 Compliance**: Standard structured data signing
- **Basic AI Validation**: Content filtering via relayer service
- **Lower Gas Costs**: Minimal contract overhead
- **Simple Architecture**: Fewer moving parts

## Architecture

```
User → Signs EIP-712 → Relayer (AI Check) → Contract (Verify & Execute)
```

## Project Structure

```
EIP712/
├── setup.sh                    # Automated setup script
├── contracts/                  # Smart contracts (Foundry project)
│   ├── src/EIPMetaTx.sol       # Main meta-transaction contract
│   ├── script/EIPMeta.s.sol    # Deployment script
│   ├── test/EIPMetaTest.t.sol  # Contract tests
│   └── foundry.toml            # Foundry configuration
├── client/                     # Client application
│   ├── signer.js               # EIP-712 signing and submission
│   ├── package.json            # Dependencies
│   └── .env                    # Configuration
├── relayer/                    # Relayer service
│   ├── index.js                # Basic Express relayer
│   ├── ollama-relayer.js       # AI-enhanced relayer
│   ├── package.json            # Dependencies
│   └── .env                    # Configuration
└── README.md                   # This file
```

## Quick Start

### Automated Setup (Recommended)

```bash
# Run the setup script
./setup.sh
```

This will:
1. Install all dependencies (Foundry, Node.js packages)
2. Deploy contracts to your chosen network
3. Configure client and relayer with contract addresses
4. Set up AI validation with Ollama

### Manual Setup

1. **Install Prerequisites**
   ```bash
   # Install Foundry
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   
   # Install Ollama (for AI validation)
   brew install ollama  # macOS
   # or download from https://ollama.ai
   ```

2. **Setup Contracts**
   ```bash
   cd contracts/
   forge install
   forge build
   forge test
   
   # Deploy to your network
   forge script script/EIPMeta.s.sol \
     --rpc-url YOUR_RPC_URL \
     --private-key YOUR_PRIVATE_KEY \
     --broadcast
   ```

3. **Setup Client**
   ```bash
   cd client/
   npm install
   
   # Update signer.js with deployed contract address
   # Edit the contractAddress variable
   ```

4. **Setup Relayer**
   ```bash
   cd relayer/
   npm install
   
   # Configure .env with:
   # CONTRACT_ADDRESS=0xYourDeployedAddress
   # RPC_URL=YourRPCEndpoint
   # PRIVATE_KEY=YourRelayerPrivateKey
   ```

## Running the System

### Start Services

1. **Start Ollama (for AI validation)**
   ```bash
   ollama serve
   ollama pull llama3.2:latest
   ```

2. **Start Relayer Service**
   ```bash
   cd relayer/
   node ollama-relayer.js  # AI-enhanced version
   # or
   node index.js          # Basic version
   ```

3. **Run Client**
   ```bash
   cd client/
   node signer.js
   ```

## How It Works

### EIP-712 Domain Structure

```javascript
const domain = {
  name: 'QoneqtMetaTx',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESS
};

const types = {
  MetaTransaction: [
    { name: 'from', type: 'address' },
    { name: 'interaction', type: 'string' },
    { name: 'nonce', type: 'uint256' }
  ]
};
```

### Transaction Flow

1. **Client Signs**: Creates EIP-712 signature for meta-transaction
2. **Relayer Validates**: Optional AI content filtering
3. **Contract Verifies**: Direct signature verification using ecrecover
4. **Contract Executes**: Processes the interaction

### AI Validation (Optional)

The relayer can perform content validation:
- Basic pattern matching (e.g., "liked_", "comment_")
- Advanced AI analysis using Ollama LLM
- Configurable approval/rejection rules

## 🧪 Testing

### Run Contract Tests
```bash
cd contracts/
forge test -vvv
```

### Test Individual Components

**Test Contract Deployment:**
```bash
# Check if contract is deployed
cast code CONTRACT_ADDRESS --rpc-url RPC_URL
```

**Test Client Signing:**
```bash
cd client/
node signer.js
```

**Test Relayer:**
```bash
cd relayer/
curl http://localhost:3000/health
```

**Test AI Service:**
```bash
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"interaction": "liked_post_123"}'
```

## vs EIP-2771 Comparison

| Feature | EIP-712 (This) | EIP-2771 |
|---------|---------------|----------|
| **Complexity** | Simple | Moderate |
| **Gas Cost** | Lower | Higher |
| **Standards** | EIP-712 only | EIP-712 + EIP-2771 |
| **Composability** | Limited | High |
| **Forwarder** | Not needed | Required |
| **AI Integration** | Basic | Advanced |

## Configuration

### Environment Variables

**Client (.env):**
```env
CONTRACT_ADDRESS=0xYourContractAddress
RPC_URL=http://localhost:8545
USER_PRIVATE_KEY=0xYourUserPrivateKey
```

**Relayer (.env):**
```env
CONTRACT_ADDRESS=0xYourContractAddress
RPC_URL=http://localhost:8545
RELAYER_PRIVATE_KEY=0xYourRelayerPrivateKey
OLLAMA_URL=http://localhost:11434
PORT=3000
```

### Network Configuration

**Local Development (Anvil):**
```bash
anvil --host 0.0.0.0 --port 8545
```

**Avalanche Subnet:**
```bash
export RPC_URL="http://localhost:9650/ext/bc/YOUR_SUBNET_ID/rpc"
export CHAIN_ID="930393"
```

## Troubleshooting

### Common Issues

1. **"Invalid signature" error**
   - Verify EIP-712 domain parameters match
   - Check user private key corresponds to signer address
   - Ensure nonce is correct

2. **"Contract not found"**
   - Verify contract is deployed to the correct network
   - Check CONTRACT_ADDRESS in configuration files

3. **"Relayer not responding"**
   - Ensure relayer service is running on correct port
   - Check relayer has ETH for gas fees
   - Verify network connectivity

4. **"AI validation failed"**
   - Check Ollama is running: `curl http://localhost:11434/api/tags`
   - Verify model is pulled: `ollama list`
   - Test interaction content matches expected patterns

### Debug Commands

```bash
# Check contract state
cast call CONTRACT_ADDRESS "nonces(address)(uint256)" USER_ADDRESS --rpc-url RPC_URL

# View recent transactions
cast logs --address CONTRACT_ADDRESS --rpc-url RPC_URL

# Test signature verification
cast call CONTRACT_ADDRESS "verify(address,string,uint256,bytes)(bool)" \
  USER_ADDRESS "test_interaction" NONCE SIGNATURE --rpc-url RPC_URL
```

## Next Steps

### Immediate Improvements
- Enhanced AI validation models
- Batch transaction support
- Gas optimization
- Better error handling

### Production Enhancements
- Frontend integration
- Wallet connectivity (MetaMask, WalletConnect)
- Multi-network deployment
- Monitoring and analytics

## References

- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Ollama Documentation](https://ollama.ai/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)

## License

MIT License - Compatible with all dependencies

---

**Simple, efficient, and effective meta-transactions!**
