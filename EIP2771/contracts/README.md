# EIP-2771 Meta-Transaction System with AI Validation

## Overview

This implementation demonstrates an **EIP-2771 gasless meta-transaction system** with **Ollama AI validation**. Users sign meta-transactions that are executed by a relayer, with AI-powered content moderation happening before any gas is spent.

## Key Features

- **Gasless Transactions**: Users don't need ETH for gas fees
- **AI Content Moderation**: Ollama-powered semantic validation
- **EIP-2771 Standard**: Full compliance with meta-transaction standard
- **Significance Scoring**: AI confidence-based decision making
- **Fallback Validation**: Basic pattern matching as backup
- **Real-time Processing**: Immediate AI feedback

## Architecture

```
User → Signs Meta-Tx → AI Service → Validates Content → Forwarder → Target Contract
                           ↓
                    Ollama LLM Model
```

## Project Structure

```
EIP2771/
├── src/
│   ├── AIValidatedForwarder.sol      # EIP-2771 forwarder with AI validation
│   └── MetaTxInteractionRecipient.sol # Target contract with ERC2771Context
├── script/
│   └── DeployLocal.s.sol             # Deployment script
├── test/
│   └── EIP2771Test.t.sol             # Comprehensive test suite
├── client/
│   ├── signer.js                     # Meta-transaction client
│   └── package.json                  # Client dependencies
├── ollama-ai-service.js              # AI validation service
├── package.json                      # Service dependencies
├── foundry.toml                      # Foundry configuration
└── README.md                         # This file
```

## Complete Setup Guide

### Prerequisites

1. **Install Foundry** (for smart contracts)
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. **Install Node.js** (v18+ recommended)
```bash
# Using nvm
nvm install 18
nvm use 18
```

3. **Install Ollama** (for AI validation)
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai
```

4. **Start Ollama and pull model**
```bash
# Start Ollama service
ollama serve

# In another terminal, pull the model
ollama pull llama3.2:latest

# Verify installation
ollama list
```

### Step 1: Setup and Deploy Smart Contracts

```bash
# Navigate to EIP2771 directory
cd EIP2771/

# Install Foundry dependencies
forge install

# Build contracts
forge build

# Run comprehensive tests
forge test -vvv

# Deploy to Avalanche subnet (or your preferred network)
forge script script/DeployLocal.s.sol \
  --rpc-url http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

**Note the deployed contract addresses from the output!**

### Step 2: Setup AI Validation Service

```bash
# Install service dependencies
npm install

# Update contract addresses in ollama-ai-service.js
# Edit the following variables with your deployed addresses:
# - FORWARDER_ADDRESS
# - RECIPIENT_ADDRESS

# Start the AI validation service
npm start
# or
node ollama-ai-service.js
```

### Step 3: Setup Client

```bash
# Navigate to client directory
cd client/

# Install client dependencies
npm install

# Update contract addresses in signer.js
# Edit the following variables:
# - FORWARDER_ADDRESS  
# - RECIPIENT_ADDRESS

# Run the client
npm start
# or
node signer.js
```

## Running the Complete System

### Terminal Setup (4 terminals needed)

#### Terminal 1: Blockchain (if using local)
```bash
# Option A: Start Anvil for local testing
anvil --host 0.0.0.0 --port 8545

# Option B: Or ensure Avalanche subnet is running
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc
```

#### Terminal 2: Ollama Service
```bash
# Start Ollama (if not already running)
ollama serve

# Keep this running throughout testing
```

#### Terminal 3: AI Validation Service
```bash
cd EIP2771/

# Start the AI service
node ollama-ai-service.js

# You should see:
# 🤖 EIP-2771 Ollama AI Validation Service
# =======================================
# EIP-2771 AI Validation Service running on port 3001
```

#### Terminal 4: Client
```bash
cd EIP2771/client/

# Run the meta-transaction client
node signer.js

# This will test multiple interactions and show AI decisions
```

## Configuration

### 1. Update Contract Addresses

After deployment, update these files with your contract addresses:

**`ollama-ai-service.js`**:
```javascript
const FORWARDER_ADDRESS = '0xYourForwarderAddress';
const RECIPIENT_ADDRESS = '0xYourRecipientAddress';
```

**`client/signer.js`**:
```javascript
const FORWARDER_ADDRESS = '0xYourForwarderAddress';
const RECIPIENT_ADDRESS = '0xYourRecipientAddress';
```

## 🧪 Testing the System

### 1. Health Checks

```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check AI Service
curl http://localhost:3001/health

# Check blockchain
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  YOUR_RPC_URL
```

### 2. Test AI Validation Only

```bash
# Test individual interactions
curl -X POST http://localhost:3001/testValidation \
  -H "Content-Type: application/json" \
  -d '{"interaction": "liked_post_12345"}'

curl -X POST http://localhost:3001/testValidation \
  -H "Content-Type: application/json" \
  -d '{"interaction": "spam_everyone_now"}'
```

### 3. Full Meta-Transaction Test

```bash
cd EIP2771/client/
node signer.js
```

Expected output:
```
EIP-2771 Ollama AI Meta-Transaction Client Started
==================================================

🧪 Testing interaction: "liked_post_12345"
🤖 AI Test Result: { approved: true, significance: 1.0 }
Success! Transaction: 0x123...
AI Decision: APPROVED

🧪 Testing interaction: "spam_everyone_now"  
🤖 AI Test Result: { approved: false, significance: 1.0 }
Failed: AI Validation failed: Transaction rejected by AI validation
```

## Troubleshooting

### Common Issues

1. **"Ollama connection failed"**
   ```bash
   # Check if Ollama is running
   ps aux | grep ollama
   
   # Start Ollama
   ollama serve
   
   # Pull model if needed
   ollama pull llama3.2:latest
   ```

2. **"Contract not found" or "Invalid address"**
   ```bash
   # Redeploy contracts
   forge script script/DeployLocal.s.sol --broadcast
   
   # Update addresses in service and client files
   ```

3. **"Gas estimation failed"**
   ```bash
   # Check relayer account has ETH
   # Verify contract addresses are correct
   # Test with simpler transaction first
   ```

4. **"AI Service not responding"**
   ```bash
   # Check service is running on port 3001
   curl http://localhost:3001/health
   
   # Restart service
   node ollama-ai-service.js
   ```

## Success Indicators

If everything is working correctly, you should see:

1. Ollama responding to API calls
2. AI service running on port 3001
3. Contracts deployed and accessible
4. Client successfully signing meta-transactions
5. AI making correct approval/rejection decisions
6. Meta-transactions executing on-chain (for approved content)

This represents a **complete gasless meta-transaction system with AI validation** - a significant advancement in blockchain UX and content moderation!

## Documentation Links

- [EIP-2771 Specification](https://eips.ethereum.org/EIPS/eip-2771)
- [OpenZeppelin ERC2771](https://docs.openzeppelin.com/contracts/4.x/api/metatx)
- [Ollama Documentation](https://ollama.ai/docs)
- [Foundry Book](https://book.getfoundry.sh/)

## License

MIT License - Compatible with OpenZeppelin contracts
