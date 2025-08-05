# QOBI Relayer System

JavaScript off-chain system for the QOBI social mining platform with AI-powered validation using Ollama.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Validator  │    │ Relayer Service │    │   Blockchain    │
│  (Ollama LLM)   │────│  (JavaScript)   │────│  (Solidity)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
    Validates social        Builds Merkle           Stores daily
    interactions &          trees & submits         trees & enables
    calculates QOBI         EIP712 signatures       user claims
```

## 📋 Components

### 🤖 AI Validator (`src/ai-validator.js`)
- Uses Ollama to validate social interactions
- Calculates QOBI rewards based on content quality
- Supports 6 interaction types: CREATE, LIKES, COMMENTS, TIPPING, CRYPTO, REFERRALS
- Fallback scoring when AI is unavailable

### ⚡ Relayer Service (`src/relayer-service.js`)
- Automated daily tree processing
- EIP712 signature generation for secure submission
- Permission checking and error handling
- Auto-processing mode with configurable intervals

### 🌳 Merkle Tree Builder (`src/merkle-tree.js`)
- Off-chain Merkle tree construction
- Proof generation for gas-efficient claims
- Keccak256 hashing for Solidity compatibility

### ✍️ EIP712 Signer (`src/eip712-signer.js`)
- Type-safe off-chain signatures
- Submission data verification
- Domain separation for security

## 🚀 Quick Start

### Prerequisites
```bash
# Install Node.js dependencies
npm install

# Start Anvil blockchain
anvil

# Start Ollama AI service
ollama serve

# Download AI model (3B parameter model recommended)
ollama pull llama3.2:3b
```

## Environment Configuration

Check `.env` file has correct deployed contract addresses:
```bash
# Blockchain Configuration
RPC_URL=http://localhost:8545
CHAIN_ID=31337
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Contract Addresses (from deployment)
SYSTEM_DEPLOYER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ACCESS_CONTROL_ADDRESS=0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
DAILY_TREE_ADDRESS=0xeEBe00Ac0756308ac4AaBfD76c05c4F3088B8883
MERKLE_DISTRIBUTOR_ADDRESS=0x10C6E9530F1C1AF873a391030a1D9E8ed0630D26
STABILIZING_CONTRACT_ADDRESS=0xB7A5bd0345EF1Cc5E66bf61BdeC17D2461fBd968
RELAYER_TREASURY_ADDRESS=0x603E1BD79259EbcbAaeD0c83eeC09cA0B89a5bcC

# AI Configuration  
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# System Configuration
PORT=3000
PROCESSING_INTERVAL=60
```

## 🎮 Usage

### 1. Web Demo (Recommended)
```bash
npm start
# Opens http://localhost:3000 with interactive dashboard
```

### 2. Command Line Interface
```bash
# Show system status
node cli.js status

# Process daily trees manually
node cli.js process

# Start auto-processing (every 60 minutes)
node cli.js auto 60

# Test AI validator
node cli.js test-ai

# Demo AI validation
node cli.js validate 0

# Show help
node cli.js help
```

### 3. Integration Tests
```bash
npm test
# Runs comprehensive system tests
```

## 🔧 API Endpoints

- `GET /api/status` - System status and tree information
- `POST /api/process` - Trigger daily tree processing
- `GET /api/ai/test` - Test AI validator connection
- `POST /api/ai/validate` - Validate sample interactions
- `GET /api/trees/:day` - Get trees for specific day
- `GET /api/overview` - System overview and health

## 🎯 Workflow

1. **AI Validation**: Ollama analyzes social interactions and assigns quality scores (0-100 points)
2. **QOBI Calculation**: Points determine token allocation based on daily caps per interaction type
3. **Merkle Tree**: Off-chain tree construction with qualified users and amounts
4. **EIP712 Signature**: Secure signing of submission data
5. **Blockchain Submission**: Relayer submits tree to DailyTreeGenerator contract
6. **User Claims**: Users can claim QOBI tokens with Merkle proofs

## 📊 Interaction Types & Daily Caps

| Type | Description | Daily QOBI Cap |
|------|-------------|---------------|
| CREATE | Content creation | 1.49 QOBI |
| LIKES | Social engagement | 0.05 QOBI |
| COMMENTS | Community interaction | 0.6 QOBI |
| TIPPING | Peer rewards | 7.96 QOBI |
| CRYPTO | Blockchain activity | 9.95 QOBI |
| REFERRALS | Network growth | 11.95 QOBI |

## 🛠️ Development

### File Structure
```
relayer-system/
├── src/
│   ├── ai-validator.js     # AI validation logic
│   ├── relayer-service.js  # Main relayer service
│   ├── merkle-tree.js      # Merkle tree utilities
│   └── eip712-signer.js    # EIP712 signature handling
├── demo-server.js          # Web demo server
├── cli.js                  # Command line interface
├── test-integration.js     # Integration tests
├── package.json            # Dependencies
└── .env                    # Configuration
```

## 🔍 Troubleshooting

### Common Issues

**AI Validator Not Working**
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if needed
ollama serve

# Download model if missing
ollama pull llama3.2:3b
```

**Relayer Not Authorized**
```bash
# Check relayer permissions
node cli.js status

# Grant relayer role (run in contracts directory)
forge script script/DeployQOBISystem.s.sol --rpc-url http://localhost:8545 --broadcast
```

**Transaction Failures**
- Check Anvil is running on port 8545
- Verify contract addresses in `.env`
- Ensure relayer has ETH for gas fees

## 🎉 Demo Features

- Interactive web dashboard
- Real-time AI validation
- Merkle tree visualization
- Transaction monitoring
- Auto-refresh status updates
- One-click tree processing

### 4. Test System
```bash
npm run test
```

## Architecture

### AI Validator (`src/ai-validator.js`)
- Connects to Ollama for AI-powered interaction validation
- Processes social interactions (CREATE, LIKES, COMMENTS, etc.)
- Calculates user points (0-100 scale)
- Determines QOBI allocations

### Relayer (`src/relayer.js`)
- Retrieves validated data from AI validator
- Builds Merkle trees off-chain
- Creates EIP712 signatures
- Submits to DailyTreeGenerator contract

### Core Components

1. **MerkleTreeBuilder** - Efficient Merkle tree construction
2. **EIP712Signer** - Type-safe signature creation
3. **ContractInteractor** - Blockchain communication
4. **AIValidator** - Ollama-powered validation
5. **DataProcessor** - Batch processing utilities

## Demo Flow

1. Generate mock social interactions
2. AI validates and scores interactions
3. Calculate Merkle trees off-chain
4. Create EIP712 signatures
5. Submit to smart contracts
6. Verify on-chain storage
7. Test user claiming

## Interaction Types

- **CREATE (0)**: Content creation (1.49 QOBI cap)
- **LIKES (1)**: Social engagement (0.05 QOBI cap)
- **COMMENTS (2)**: Community interaction (0.6 QOBI cap)
- **TIPPING (3)**: Peer rewards (7.96 QOBI cap)
- **CRYPTO (4)**: Blockchain activity (9.95 QOBI cap)
- **REFERRALS (5)**: Network growth (11.95 QOBI cap)
