# Quick Start Guide

## Prerequisites
- Node.js (v16+)
- Foundry (forge, anvil, cast)

## One-Command Setup

```bash
./setup.sh
```

This script will:
1. ✅ Check prerequisites
2. 📦 Install contract dependencies
3. 🔨 Build smart contracts
4. 🚀 Start Anvil (if not running)
5. 📄 Deploy contracts
6. ⚙️ Update configurations
7. 📦 Install Node.js dependencies

## Manual Setup (Alternative)

### 1. Install Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Setup Contracts
```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
```

### 3. Start Anvil
```bash
anvil
```

### 4. Deploy Contract
```bash
forge create --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  src/EIPMetaTx.sol:MetaTxInteraction
```

### 5. Install Dependencies
```bash
# Relayer
cd relayer && npm install

# Client  
cd ../client && npm install
```

### 6. Update Configuration
- Update `CONTRACT_ADDRESS` in `relayer/.env`
- Update contract address and private key in `client/signer.js`

## Running the System

### Terminal 1: Anvil
```bash
anvil
```

### Terminal 2: Relayer
```bash
cd relayer
npm start
```

### Terminal 3: Client
```bash
cd client
npm start
```

## Testing Different Interactions

Edit `client/signer.js` and change the `interaction` variable:

```javascript
// ✅ These will be accepted by AI validator
const interaction = 'liked_post';
const interaction = 'comment_added';

// ❌ This will be rejected
const interaction = 'spam_message';
```

## Troubleshooting

- Ensure Anvil is running on port 8545
- Check that contract address is correct in both relayer and client
- Verify private keys match the expected addresses
- Make sure nonces are sequential (restart Anvil to reset)

## Next Steps

See the main [README.md](README.md) for detailed documentation and advanced features.
