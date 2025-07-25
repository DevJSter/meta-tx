const dotenv = require('../relayer/node_modules/dotenv');
const path = require('path');

// Load environment variables from the relayer directory
dotenv.config({ path: path.join(__dirname, '../relayer/.env') });

// Validate required environment variables
const requiredEnvVars = [
  'RPC_URL',
  'CONTRACT_ADDRESS',
  'RELAYER_PRIVATE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file in the relayer directory');
  process.exit(1);
}

// Validate contract address format
if (!process.env.CONTRACT_ADDRESS.match(/^0x[a-fA-F0-9]{40}$/)) {
  console.error('❌ Invalid CONTRACT_ADDRESS format. Must be a valid Ethereum address');
  process.exit(1);
}

// Global configuration object
const config = {
  // Blockchain Configuration
  blockchain: {
    rpcUrl: process.env.RPC_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    qobitContractAddress: process.env.QOBIT_CONTRACT_ADDRESS,
    chainId: 202102,
    networkName: 'thane-testnet',
    
    // Network configuration for ethers
    networkConfig: {
      name: 'thane-testnet',
      chainId: 202102
      // No ENS configuration - custom network
    }
  },

  // Wallet Configuration
  wallet: {
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
    // Test user wallet (for client signer)
    testUserPrivateKey: '0x829d62188cc5ff0a1dc21cf31efb7cb36d415ced40e71b9ee294a82f3025a7b3'
  },

  // EIP-712 Domain Configuration
  eip712: {
    domain: {
      name: "QoneqtMetaTx",
      version: "1",
      chainId: 202102,
      get verifyingContract() {
        return config.blockchain.contractAddress;
      }
    },
    types: {
      MetaTx: [
        { name: "user", type: "address" },
        { name: "interaction", type: "string" },
        { name: "nonce", type: "uint256" }
      ]
    }
  },

  // Ollama AI Configuration
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:latest',
    fallbackModels: ['llama3', 'llama2', 'mistral', 'codellama']
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3001,
    relayerBaseUrl: `http://localhost:${parseInt(process.env.PORT) || 3001}`
  },

  // AI Validation Configuration
  validation: {
    significanceThreshold: parseFloat(process.env.SIGNIFICANCE_THRESHOLD) || 0.5,
    maxSignificance: 10.0,
    minSignificance: 0.1,
    rejectLowConfidence: process.env.REJECT_LOW_CONFIDENCE !== 'false',
    
    // Rate limiting
    rateLimitWindow: 60000, // 1 minute
    rateLimitMaxRequests: 10, // Max requests per minute per user
    
    // Gas estimation
    estimatedGasLimit: 200000n,
    defaultGasPrice: 25000000001n,
    
    // Transaction timeout
    transactionTimeout: 30000 // 30 seconds
  },

  // Interaction Examples for Testing
  interactions: {
    examples: [
      // High-value interactions
      'create_post-educational_blockchain_guide_2024',
      'create_post-community_discussion_dao_governance',  
      'write_article-defi_security_best_practices',
      
      // Medium-value interactions
      'comment_post-thanks_for_sharing_this_insight',
      'share_post-valuable_research_data_analysis',
      'join_community-blockchain_developers_guild',
      'follow_user-expert_smart_contract_auditor',
      
      // Basic-value interactions
      'like_post-12345',
      'react_post-heart_emoji_67890',
      'bookmark_post-save_for_later_98765',
      'vote_poll-option_a_governance_proposal_123'
    ],
    
    // Pattern matching for fallback validation
    patterns: {
      high_value: {
        patterns: ['create_post', 'write_article', 'start_discussion', 'educational_', 'tutorial_'],
        baseScore: 6.0,
        approved: true
      },
      medium_value: {
        patterns: ['comment_', 'reply_', 'share_post', 'join_community', 'follow_user'],
        baseScore: 3.0,
        approved: true
      },
      basic_value: {
        patterns: ['like_', 'react_', 'vote_', 'bookmark_'],
        baseScore: 1.0,
        approved: true
      },
      suspicious: {
        patterns: ['spam_', 'bot_', 'fake_', 'scam_', 'abuse_'],
        baseScore: 0.1,
        approved: false
      }
    }
  },

  // Development and Debug Configuration
  debug: {
    enableConsoleLogging: true,
    enableDetailedErrors: true,
    enableStaticCallValidation: true
  }
};

// Helper functions
config.helpers = {
  // Get a random interaction example
  getRandomInteraction() {
    const examples = config.interactions.examples;
    return examples[Math.floor(Math.random() * examples.length)];
  },

  // Validate if an address is properly formatted
  isValidAddress(address) {
    return address && address.match(/^0x[a-fA-F0-9]{40}$/);
  },

  // Get scaled significance for contract (multiply by 100)
  getScaledSignificance(significance) {
    return Math.round(significance * 100);
  },

  // Get original significance from scaled (divide by 100)
  getOriginalSignificance(scaledSignificance) {
    return scaledSignificance / 100;
  }
};

// Environment validation on import
console.log('🔧 Global Configuration Loaded');
console.log('==============================');
console.log(`🔗 Contract: ${config.blockchain.contractAddress}`);
console.log(`🌐 Network: ${config.blockchain.rpcUrl}`);
console.log(`🤖 AI Model: ${config.ollama.model}`);
console.log(`📊 Significance Threshold: ${config.validation.significanceThreshold}`);
console.log(`🔗 Server Port: ${config.server.port}`);
console.log('');

module.exports = config;
