# Enhanced AI-Validated Social Interaction System with Token Rewards

A comprehensive blockchain-based social platform that uses AI validation to assess user interactions and rewards quality contributions with **Qobit (QBIT)** tokens.

## Features

### AI-Powered Validation
- **Advanced Ollama Integration**: Uses local LLM models for content moderation
- **Significance Scoring**: 0.1-10.0 scale for interaction value assessment
- **Context-Aware Analysis**: Considers user history and interaction patterns
- **Fallback Systems**: Robust pattern matching when AI is unavailable

### Enhanced Scoring System
- **High-Value Content** (6.0-10.0): Educational posts, tutorials, community building
- **Medium-Value Content** (2.0-5.0): Quality comments, shares, community participation  
- **Basic Interactions** (0.5-2.0): Likes, reactions, simple engagement
- **Spam/Harmful** (0.1-0.5): Automatically rejected or heavily penalized

### Token Economy (Qobit - QBIT)
- **Daily Minting**: Users can mint tokens once per day based on accumulated points
- **Streak Bonuses**: Up to 50% bonus for consecutive daily activities
- **Gas-Free Interactions**: Meta-transactions sponsored by relayers for earning points
- **Self-Paid Minting**: Users pay their own gas for token minting
- **Leaderboard System**: Track top contributors and their rewards

### Security & Rate Limiting
- **EIP-712 Signatures**: Secure meta-transaction signing
- **Nonce Management**: Prevents replay attacks
- **Rate Limiting**: 10 requests per minute per user
- **Cooldown Periods**: Prevents spam with interaction-specific timeouts

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │  AI Relayer     │    │  Smart Contract │
│                 │    │                 │    │                 │
│ • Sign EIP-712  │───▶│ • Validate AI   │───▶│ • Execute Tx    │
│ • Send MetaTx   │    │ • Rate Limit    │    │ • Track Points  │
│ • View Stats    │    │ • Context Check │    │ • Mint Rewards  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
        ┌─────────────────┐
        │  Ollama LLM     │
        │                 │
        │ • Content Mod   │
        │ • Significance  │
        │ • Categorization│
        └─────────────────┘
```

## Project Structure

```
EIP712/
├── contracts/
│   ├── src/
│   │   ├── EIPMetaTx.sol        # Enhanced meta-transaction contract
│   │   └── Minting.sol          # Qobit token with rewards
│   └── script/
│       └── DeployAll.s.sol      # Deployment script
├── relayer/
│   ├── ollama-relayer.js        # Enhanced AI relayer service
│   ├── .env                     # Configuration
│   └── package.json
├── client/
│   ├── signer.js                # Enhanced interaction client
│   ├── qobit-dashboard.js       # Token dashboard
│   └── package.json
└── README.md
```

## Quick Start

### 1. Prerequisites

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a language model
ollama pull llama2
# or
ollama pull llama3.2:latest

# Install Node.js dependencies
cd relayer && npm install
cd ../client && npm install
```

### 2. Deploy Contracts

```bash
cd contracts

# Set environment variables
export PRIVATE_KEY=your_private_key
export RPC_URL=your_rpc_url

# Deploy contracts
forge script script/DeployAll.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# Update addresses in .env files
```

### 3. Configure Environment

Update `relayer/.env`:
```env
RPC_URL=http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc
CONTRACT_ADDRESS=0x_your_deployed_contract_address
RELAYER_PRIVATE_KEY=0x_your_relayer_private_key
QOBIT_CONTRACT_ADDRESS=0x_your_qobit_token_address
OLLAMA_MODEL=llama2
PORT=8000
SIGNIFICANCE_THRESHOLD=0.5
```

### 4. Start Services

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start AI Relayer
cd relayer
node ollama-relayer.js

# Terminal 3: Test Client
cd client
node signer.js
```

## Usage Examples

### Basic Interaction
```bash
# Single random interaction
node signer.js

# Custom interaction
node signer.js custom "create_post-blockchain_security_guide"

# Multiple interactions
node signer.js multiple 5
```

### Token Dashboard
```bash
# View user stats and balance
node qobit-dashboard.js dashboard

# View leaderboard
node qobit-dashboard.js leaderboard

# Earn points through interactions
node qobit-dashboard.js earn 3

# Mint daily rewards
node qobit-dashboard.js mint

# Full demo workflow
node qobit-dashboard.js full
```

### Health Monitoring
```bash
# Check relayer health
node signer.js health

# Test AI validation
curl -X POST http://localhost:8000/validate \
  -H "Content-Type: application/json" \
  -d '{"interaction": "create_post-test", "userAddress": "0x..."}'
```

## AI Validation Examples

### High-Value Interactions (6.0-10.0 points)
```javascript
"create_post-comprehensive_defi_security_analysis"
"write_article-smart_contract_best_practices"  
"educational_content-how_to_audit_contracts"
"community_building-organize_developer_meetup"
```

### Medium-Value Interactions (2.0-5.0 points)  
```javascript
"comment_post-great_insights_on_tokenomics"
"share_post-important_protocol_update"
"join_community-blockchain_developers"
"follow_user-security_expert_researcher"
```

### Basic Interactions (0.5-2.0 points)
```javascript
"like_post-12345"
"react_post-heart_emoji"
"bookmark_post-save_for_later"
"vote_poll-governance_proposal"
```

## Token Economics

### Daily Rewards Formula
```
Base Reward = (Daily Points × Base Rate) / 100
Streak Bonus = Min(50%, Consecutive Days × 10%)
Final Reward = Base Reward × (100% + Streak Bonus)
Capped at: Max Daily Mint (100 QBIT default)
```

### Interaction Point Values
| Type | Base Points | Cooldown | Examples |
|------|-------------|----------|----------|
| **Create Post** | 100 | 1 hour | Original content, tutorials |
| **Join Community** | 75 | 2 hours | New community engagement |
| **Share Post** | 50 | 30 min | Quality content sharing |
| **Follow User** | 30 | 30 min | Network building |
| **Comment** | 25 | 10 min | Thoughtful responses |
| **Like/React** | 10 | 5 min | Basic engagement |

### Significance Multipliers
- **AI Significance Score**: 0.1x to 10.0x multiplier
- **Final Points** = Base Points × (AI Score / 100)
- **Example**: Comment (25 base) × 8.5 significance = 212.5 final points

## Advanced Configuration

### Relayer Settings
```env
# AI Model Configuration
OLLAMA_MODEL=llama3.2:latest
OLLAMA_URL=http://localhost:11434

# Validation Thresholds
SIGNIFICANCE_THRESHOLD=0.5        # Minimum significance to pass
MAX_SIGNIFICANCE=10.0             # Maximum possible significance
MIN_SIGNIFICANCE=0.1              # Minimum possible significance

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10        # Requests per minute per user
RATE_LIMIT_WINDOW=60000           # Rate limit window (ms)

# Token Economy
ENABLE_TOKEN_REWARDS=true
BASE_REWARD_PER_POINT=0.001       # QBIT per point
```

### Contract Configuration
```solidity
// Interaction Types (can be added via owner)
addInteractionType("create_post", 100, 3600);    // 100 base points, 1 hour cooldown
addInteractionType("premium_content", 200, 7200); // 200 base points, 2 hour cooldown

// Reward Parameters (adjustable by owner)
updateRewardParameters(
 1e15,        // 0.001 QBIT per point
 100e18,      // 100 QBIT max daily mint
 100          // 1.00 minimum points to mint
);
```

## Testing & Development

### Run Test Suite
```bash
# Test different interaction types
node signer.js test

# Stress test with multiple interactions
node signer.js multiple 10

# Test specific edge cases
node signer.js custom "spam_post-buy_my_token"  # Should be rejected
node signer.js custom "educational_content-advanced_cryptography"  # High value
```

### Monitor AI Performance
```bash
# Check Ollama status
curl http://localhost:8000/ollama-status

# View relayer health
curl http://localhost:8000/health

# Get user statistics
curl http://localhost:8000/user/0xYourAddress/stats
```

### Debug Mode
```bash
# Enable detailed logging
DEBUG=true node ollama-relayer.js

# Test validation without transactions
node signer.js validate "your_interaction_here"
```

## Common Issues & Solutions

### 1. AI Model Not Found
```bash
# Check available models
ollama list

# Pull required model
ollama pull llama2

# Update .env with available model
OLLAMA_MODEL=llama2
```

### 2. Rate Limiting Errors
```bash
# Increase rate limits in .env
RATE_LIMIT_MAX_REQUESTS=20

# Add delays between requests
node signer.js multiple 5  # Has built-in delays
```

### 3. Low Significance Scores
- Use more descriptive interaction names
- Include educational or community-building elements
- Avoid generic interactions like "like_post-123"

### 4. Nonce Mismatch
```bash
# Check current nonce
curl http://localhost:8000/nonce/0xYourAddress

# Reset if needed (redeploy contract)
```

## Monitoring & Analytics

### Key Metrics to Track
- **User Engagement**: Total interactions, daily active users
- **AI Performance**: Approval rates, significance distribution
- **Token Distribution**: Daily mints, leaderboard changes
- **System Health**: Relayer uptime, transaction success rate

### Leaderboard Queries
```javascript
// Get top 10 users
const leaderboard = await qobitContract.getLeaderboard(10);

// Get user rank
const userIndex = await qobitContract.leaderboardIndex(userAddress);

// Get user's daily points history
const todayPoints = await qobitContract.getUserDailyPoints(userAddress, currentDay);
```

## Future Enhancements

### Planned Features
- [ ] **Multi-Model AI**: Support for multiple LLM models
- [ ] **Community Governance**: DAO voting for parameter changes
- [ ] **NFT Rewards**: Special NFTs for top contributors
- [ ] **Cross-Chain Support**: Deploy on multiple networks
- [ ] **Mobile App**: React Native mobile interface
- [ ] **Analytics Dashboard**: Web-based monitoring interface

### Integration Opportunities
- [ ] **Social Media APIs**: Import interactions from Twitter, Discord
- [ ] **DeFi Protocols**: Integrate with lending/staking platforms
- [ ] **Identity Systems**: ENS, Lens Protocol integration
- [ ] **Content Platforms**: Mirror, Paragraph integration

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Test thoroughly with various interaction types
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Ollama Team**: For the excellent local LLM platform
- **OpenZeppelin**: For secure smart contract libraries
- **Foundry**: For the powerful development framework
- **Ethers.js**: For seamless blockchain interactions

---

**Built with love for the decentralized social future**

For support and questions, please open an issue or reach out to the development team.


the contracts are deployed tho 

<!-- 
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script script/Dep
loyAll.s.sol --via-ir --broadcast --rpc-url https://subnets.avax.network/thane/testnet/rpc
[⠊] Compiling...
No files changed, compilation skipped
Script ran successfully.

== Logs ==
  === Starting Deployment ===
  Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Chain ID: 202102
  MetaTxInteraction deployed at: 0x59b670e9fA9D0A427751Af201D676719a970857b
  QobitToken deployed at: 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1
  === Verification ===
  MetaTx minting contract: 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1
  QobitToken meta contract: 0x59b670e9fA9D0A427751Af201D676719a970857b
  Authorized relayer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  QobitToken total supply: 1000000 tokens
  QobitToken deployer balance: 1000000 tokens
  === Configured Interaction Types ===
  like_post: base=10 cooldown=300 active=true
  create_post: base=100 cooldown=3600 active=true
  === Deployment Summary ===
  MetaTx Contract: 0x59b670e9fA9D0A427751Af201D676719a970857b
  Qobit Token: 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1
  Relayer Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Domain Separator: 0x1d5d2fb96337ed8d227e163e5f59f69badfa4566f2a62de77c330aaa4755d219
  Ready for AI relayer service!
  =========================

## Setting up 1 EVM.

==========================

Chain 202102

Estimated gas price: 50.000000001 gwei

Estimated total gas used for script: 4427747

Estimated amount required: 0.221387350004427747 ETH

==========================

##### 202102
✅  [Success] Hash: 0x24a0c4087dad2f6296d4b457e9ac87ac0733b11311e16b939a60399977366c04
Contract Address: 0x59b670e9fA9D0A427751Af201D676719a970857b
Block: 56
Paid: 0.037773225001510929 ETH (1510929 gas * 25.000000001 gwei)


##### 202102
✅  [Success] Hash: 0x6dce89511f0af29e0b9595f0a8c4914dbb54010c4fa81c13af50867900e2f6f9
Block: 57
Paid: 0.001186850000047474 ETH (47474 gas * 25.000000001 gwei)


##### 202102
✅  [Success] Hash: 0x26801b4178f58f14fe6597dbcb4fc21ce41c69e09adf19dcf5239218e84cc845
Block: 57
Paid: 0.001195100000047804 ETH (47804 gas * 25.000000001 gwei)


##### 202102
✅  [Success] Hash: 0x755b7d55c6c1b1a5952a974d5dd45bce69f8746a13e073f458a8127d003cc7de
Block: 57
Paid: 0.001759450000070378 ETH (70378 gas * 25.000000001 gwei)


##### 202102
✅  [Success] Hash: 0xb94257ab63ec1e4e7e751da3810613670ec5629f1ea98030b830e7bece6afdea
Contract Address: 0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1
Block: 57
Paid: 0.042791450001711658 ETH (1711658 gas * 25.000000001 gwei)

✅ Sequence #1 on 202102 | Total Paid: 0.084706075003388243 ETH (3388243 gas * avg 25.000000001 gwei)
                                                                                                                                             

==========================

ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.

Transactions saved to: /Users/qoneqt/Desktop/shubham/ava-chain/new-ai-validator/EIP712/contracts/broadcast/DeployAll.s.sol/202102/run-latest.json

Sensitive values saved to: /Users/qoneqt/Desktop/shubham/ava-chain/new-ai-validator/EIP712/contracts/cache/DeployAll.s.sol/202102/run-latest.json


now run the projects -->
<!-- 
from the whole project remove all the emojis instead use normal simple non ai looking checks 
 -->
