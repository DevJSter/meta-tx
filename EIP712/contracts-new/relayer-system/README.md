# QOBI Relayer System

**Quantum Oracle Blockchain Intelligence - Advanced Relayer with AI Validation**

A sophisticated blockchain relayer system that integrates AI-powered transaction validation, EIP-712 signing, and Merkle tree batching for secure and efficient transaction processing.

## 🌟 Features

- **AI-Powered Validation**: Real-time transaction analysis using Ollama/LLaMA models
- **EIP-712 Compliance**: Structured data signing for enhanced security
- **Merkle Tree Batching**: Efficient transaction grouping with cryptographic proofs
- **Real-time Monitoring**: Web dashboard for system oversight
- **CLI Interface**: Command-line tools for system interaction
- **Event Scanner**: Blockchain event monitoring and analysis
- **Comprehensive Testing**: Integration tests and demos

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Ollama (for AI validation)
- Access to Avalanche testnet

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   The `.env` file is already configured with:
   - Avalanche testnet RPC endpoint
   - Deployed contract addresses
   - AI model configuration

3. **Start Ollama** (for AI validation):
   ```bash
   # Install Ollama if not already installed
   # Then pull the model
   ollama pull llama3.2:latest
   ```

### Running the System

1. **Start the main relayer server**:
   ```bash
   npm start
   # or
   node demo-server.js
   ```

2. **Access the web dashboard**:
   ```bash
   node qobi-dashboard.js
   # Visit http://localhost:3001
   ```

3. **Use the CLI interface**:
   ```bash
   node cli.js --help
   ```

## 📚 Usage Examples

### Submit a Transaction

```bash
# Using CLI
node cli.js submit --from 0x... --to 0x... --value 0.1

# Using API
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"from":"0x...","to":"0x...","value":"0.1"}'
```

### Monitor System Status

```bash
# CLI status
node cli.js status

# Web dashboard
open http://localhost:3001
```

### Run Integration Tests

```bash
npm test
# or
node test-integration.js
```

## 🏗️ Architecture

### Core Components

1. **RelayerService** (`src/relayer-service.js`)
   - Main orchestrator
   - Batch processing logic
   - Transaction lifecycle management

2. **AIValidator** (`src/ai-validator.js`)
   - Ollama integration
   - Risk assessment
   - Pattern detection

3. **EIP712Signer** (`src/eip712-signer.js`)
   - Structured data signing
   - Message verification
   - Type definitions

4. **QOBIMerkleTree** (`src/merkle-tree.js`)
   - Batch organization
   - Proof generation
   - Tree verification

### API Endpoints

- `GET /` - API documentation
- `GET /status` - System statistics
- `POST /transactions` - Submit transaction
- `POST /transactions/:id/relay` - Relay transaction
- `GET /batches` - Recent batches
- `GET /merkle/:batchId` - Merkle data
- `GET /ai/status` - AI validator status

## 🛠️ Available Scripts

```bash
# Start main server
npm start

# Development mode with auto-reload
npm run dev

# Run integration tests
npm test

# Start event scanner
npm run scanner

# Start web dashboard
npm run dashboard

# Start CLI
npm run cli

# Run Merkle tree demo
npm run merkle-demo

# Run spam analysis
npm run spam-test
```

## 🔧 CLI Commands

```bash
# Submit transaction
node cli.js submit

# Check status
node cli.js status

# Relay transaction
node cli.js relay <transaction-id>

# View recent batches
node cli.js batches

# Check AI status
node cli.js ai-status

# Interactive mode
node cli.js interactive

# Run demo
node cli.js demo --count 10
```

## 📊 Monitoring & Analytics

### Web Dashboard

Visit `http://localhost:3001` for real-time monitoring:
- System statistics
- AI validator status
- Recent transaction batches
- Merkle tree information

### Event Scanner

Monitor blockchain events:

```bash
# Generate full report
node event-scanner.js report

# Verify contract deployments
node event-scanner.js verify

# Real-time monitoring
node event-scanner.js monitor

# Scan specific block range
node event-scanner.js events 1000 2000
```

## 🧪 Testing

### Integration Test

```bash
node test-integration.js
```

Tests include:
- Service initialization
- Transaction submission
- Batch processing
- AI validation
- Merkle tree operations
- Transaction relay

### Merkle Tree Demo

```bash
node merkle-demo.js
```

Demonstrates:
- Tree construction
- Proof generation
- Verification
- Import/export

## ⚙️ Configuration

### Environment Variables

Key configurations in `.env`:

```env
# Blockchain
RPC_URL=https://testnet-thane-x1c45.avax-test.network/...
CHAIN_ID=202102
PRIVATE_KEY=0x...

# Contract Addresses
SYSTEM_DEPLOYER_ADDRESS=0x30aF35b3021538959FCE5C32882De08e2cb83Fb3
ACCESS_CONTROL_ADDRESS=0x70D4f9CA8A6F7595fd4Cfd6Be35Be9f90D43bA00
# ... other contracts

# AI Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest

# System Settings
BATCH_SIZE=100
PROCESSING_INTERVAL=10000
LOG_LEVEL=info
```

### AI Model Configuration

The system supports various Ollama models:
- `llama3.2:latest` (default)
- `llama3.1:latest`
- `codellama:latest`
- Custom models

## 🔐 Security Features

1. **EIP-712 Signing**: Structured data signing prevents replay attacks
2. **AI Validation**: ML-powered risk assessment
3. **Merkle Proofs**: Cryptographic verification of batch inclusion
4. **Access Control**: Role-based permissions
5. **Rate Limiting**: Protection against spam

## 🚨 Error Handling

The system includes comprehensive error handling:
- AI service fallbacks
- Network retry logic
- Transaction validation
- Graceful degradation

## 📈 Performance

- **Batch Processing**: Configurable batch sizes
- **Concurrent Validation**: Parallel AI processing
- **Memory Efficient**: Streaming and cleanup
- **Scalable Architecture**: Microservice-ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the integration test output
2. Review the dashboard for system status
3. Use the CLI status command
4. Check Ollama connection

## 🔮 Roadmap

- [ ] Multi-chain support
- [ ] Advanced AI models
- [ ] Gas optimization
- [ ] Mobile dashboard
- [ ] GraphQL API
- [ ] WebSocket real-time updates

---

**Built with ❤️ for the Avalanche ecosystem**
