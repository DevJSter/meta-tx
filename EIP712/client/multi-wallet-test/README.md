# Multi-Wallet AI-Validated Interaction Test Suite

This directory contains a comprehensive testing suite for the AI-validated blockchain interaction system using multiple wallets simultaneously.

## 📁 Directory Structure

```
multi-wallet-test/
├── wallet1.js          # Wallet 1 test script (10 high + 10 medium + 10 low)
├── wallet2.js          # Wallet 2 test script (10 high + 10 medium + 10 low)
├── wallet3.js          # Wallet 3 test script (10 high + 10 medium + 10 low)
├── run-all.js          # Master script to run all wallets
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🎯 Test Overview

- **Total Interactions**: 90 (30 per wallet)
- **Categories per Wallet**: 10 High + 10 Medium + 10 Low significance
- **Wallets**: 3 different private keys with unique interaction sets
- **Execution Modes**: Sequential or Concurrent

## 🔑 Wallet Configuration

### Wallet 1
- **Private Key**: `0x829d62188cc5ff0a1dc21cf31efb7cb36d415ced40e71b9ee294a82f3025a7b3`
- **Focus**: Blockchain security, DeFi protocols, smart contract auditing
- **Delays**: 1.5s (high) → 1.2s (medium) → 1.0s (low)

### Wallet 2
- **Private Key**: `0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba`
- **Focus**: Advanced Solidity, EVM optimization, Layer 2 solutions
- **Delays**: 1.6s (high) → 1.3s (medium) → 1.1s (low)

### Wallet 3
- **Private Key**: `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`
- **Focus**: Web3 infrastructure, cross-chain protocols, governance
- **Delays**: 1.7s (high) → 1.4s (medium) → 0.9s (low)

## 🚀 Usage

### Prerequisites

1. Make sure the relayer is running on the configured port
2. Ensure the blockchain network is accessible
3. Install dependencies:
   ```bash
   cd multi-wallet-test
   npm install
   ```

### Running Tests

#### Option 1: Master Script (Recommended)
```bash
# Sequential execution (default)
node run-all.js
npm run test

# Concurrent execution
node run-all.js concurrent
npm run test:concurrent

# Alternative concurrent
node run-all.js parallel
npm run test:parallel
```

#### Option 2: Individual Wallets
```bash
# Run individual wallet tests
npm run wallet1
npm run wallet2
npm run wallet3

# Or directly
node wallet1.js
node wallet2.js
node wallet3.js
```

## 📊 Interaction Categories

### High Significance (Expected Score: 6.0+)
- `create_post-*`: Educational content, tutorials, research
- `write_article-*`: In-depth technical articles
- Focus on valuable community contributions

### Medium Significance (Expected Score: 3.0-5.9)
- `comment_post-*`: Thoughtful responses and feedback
- `share_post-*`: Important announcements and updates
- `join_community-*`: Professional development groups
- `follow_user-*`: Industry experts and researchers

### Low Significance (Expected Score: 1.0-2.9)
- `like_post-*`: Simple engagement actions
- `react_post-*`: Emoji reactions
- `bookmark_post-*`: Saving content for later
- `vote_poll-*`: Participation in polls

## 🔄 Execution Modes

### Sequential Mode
- Runs wallets one after another
- Easier to follow output
- Lower system resource usage
- 3-second delay between wallets

### Concurrent Mode
- Runs all wallets simultaneously
- Faster total execution time
- Higher system resource usage
- Real-time parallel processing

## 📈 Output Features

### Real-time Monitoring
- Color-coded output for each wallet
- Transaction hash and block confirmation
- AI validation results with significance scores
- Success/failure tracking with statistics

### Summary Report
```
📊 EXECUTION SUMMARY
===================
✅ Successful: 87/90
❌ Failed: 3/90
📈 Success Rate: 96.7%
⏱️  Total Execution Time: 245.3 seconds
```

### Per-Transaction Details
```
📝 [WALLET-1] Processing HIGH interaction: "create_post-blockchain_security_guide"
👤 User: 0x742d35cc6bf861C965C2860C71A88f2F3cE4d1C0
🔢 Nonce: 15
✅ HIGH Transaction successful!
📋 TX Hash: 0xabc123...
📊 Significance: 6.8
🏷️  Category: educational
⭐ Points Earned: 680
```

## 🛠️ Configuration

The test suite uses the centralized configuration from `../../config/env.js`:

- **Blockchain**: RPC URL, contract addresses, chain ID
- **EIP-712**: Domain and type definitions
- **Server**: Relayer base URL and endpoints
- **Validation**: AI model settings and thresholds

## ⚠️ Important Notes

1. **Private Keys**: Use test private keys only - never production keys
2. **Rate Limiting**: Built-in delays prevent overwhelming the relayer
3. **Error Handling**: Continues execution even if individual transactions fail
4. **Network**: Ensure stable connection to blockchain RPC
5. **Resources**: Concurrent mode requires more CPU/memory

## 🔍 Troubleshooting

### Common Issues

1. **"Relayer not healthy"**
   - Check if relayer service is running
   - Verify relayer has sufficient balance

2. **"Invalid nonce"**
   - Clear any pending transactions
   - Restart the relayer service

3. **"Network timeout"**
   - Check RPC URL connectivity
   - Verify firewall settings

4. **"Signature verification failed"**
   - Ensure EIP-712 domain matches relayer
   - Check private key format

### Debug Mode
Add debug logging by modifying the console.log statements in individual wallet scripts.

## 📝 Customization

### Adding New Interactions
Modify the interaction arrays in each wallet script:
```javascript
const highInteractions = [
  'create_post-your_new_high_value_interaction',
  // ... existing interactions
];
```

### Adjusting Delays
Change the delay values in the `runAllInteractions()` function:
```javascript
await delay(2000); // 2 second delay
```

### Different Categories
Modify the test plan by changing loop counts:
```javascript
for (let i = 0; i < 15; i++) { // 15 instead of 10
```

## 🎖️ Success Metrics

- **Transaction Success Rate**: > 95%
- **AI Validation Accuracy**: Correct significance scoring
- **Performance**: < 5 minutes total execution time
- **Error Recovery**: Graceful handling of failed transactions

## 📞 Support

For issues or questions about the multi-wallet test suite, check:
1. Relayer logs for backend issues
2. Blockchain network status
3. Configuration file validity
4. Private key and address formats
