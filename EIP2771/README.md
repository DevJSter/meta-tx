# EIP-2771 AI-Validated Meta-Transaction System

This implementation uses EIP-2771 (Meta Transaction) standard with a Forwarder contract that includes AI validation. Unlike the relayer-based EIP-712 approach, this uses the standardized EIP-2771 pattern where a Forwarder contract handles meta-transaction execution.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│                 │    │                      │    │                    │
│     Client      │───▶│  AIValidatedForwarder │───▶│ RecipientContract  │
│   (EIP-712      │    │   (EIP-2771 + AI)    │    │   (EIP-2771        │
│   Signatures)   │    │                      │    │   Compatible)      │
│                 │    │                      │    │                    │
└─────────────────┘    └──────────────────────┘    └────────────────────┘
          │                       │                           │
          │                       │                           │
          ▼                       ▼                           ▼
   Signs meta-tx            Validates with AI           Executes interaction
   using EIP-712            rules, then forwards        using _msgSender()
```

## Key Differences from EIP-712 Implementation

| Aspect | EIP-712 (Relayer) | EIP-2771 (Forwarder) |
|--------|-------------------|---------------------|
| **Standard** | Custom implementation | Standardized EIP-2771 |
| **Validation** | Relayer service | On-chain forwarder contract |
| **Gas Payment** | Relayer pays gas | Relayer pays gas |
| **Signature Verification** | Custom contract | Standard EIP-712 + EIP-2771 |
| **Sender Recovery** | Custom logic | `_msgSender()` from ERC2771Context |
| **Scalability** | Service-based | Contract-based |

## Components

### 1. AIValidatedForwarder.sol
- Extends OpenZeppelin's `ERC2771Forwarder`
- Adds AI validation rules for interactions
- Validates signatures and executes meta-transactions
- Emits events for validation results

### 2. MetaTxInteractionRecipient.sol
- Inherits from `ERC2771Context`
- Accepts meta-transactions from trusted forwarder
- Properly recovers original sender using `_msgSender()`
- Stores and manages user interactions

### 3. Client Application (signer.js)
- Signs EIP-712 messages for EIP-2771 ForwardRequest
- Submits signed requests to forwarder contract
- No need for separate relayer service

## Setup Instructions

### 1. Install Dependencies

```bash
cd EIP2771

# Install Foundry dependencies
forge install

# Install Node.js dependencies for client
cd client
npm install
```

### 2. Start Local Blockchain

```bash
# In a separate terminal
anvil
```

### 3. Deploy Contracts

```bash
# Set environment variable
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### 4. Update Client Configuration

Edit `client/signer.js` and replace:
- `FORWARDER_ADDRESS`: Address of deployed AIValidatedForwarder
- `RECIPIENT_ADDRESS`: Address of deployed MetaTxInteractionRecipient

### 5. Run the Client

```bash
cd client
node signer.js
```

## Testing

### Run Contract Tests
```bash
forge test -vv
```

## Features

- ✅ **Standard EIP-2771**: Full compliance with EIP-2771 specification
- ✅ **AI Validation**: On-chain validation rules for interactions
- ✅ **Gasless Transactions**: Users don't pay gas fees
- ✅ **Proper Sender Recovery**: Uses `_msgSender()` for original user address
- ✅ **Configurable Rules**: Add/remove AI validation rules
- ✅ **Security**: Built on OpenZeppelin's audited contracts

## License

MIT License - Compatible with OpenZeppelin contracts
