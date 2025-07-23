const express = require('express');
const ethers = require('ethers');
const dotenv = require('dotenv');
const MetaTxInteraction = require('./MetaTxInteraction.json');

// Use global fetch if available (Node.js v18+), otherwise fallback to node-fetch
let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch {
  fetch = require('node-fetch');
}

dotenv.config();
const app = express();
app.use(express.json());

// Enhanced configuration with new features
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const PORT = process.env.PORT || 3001;
const SIGNIFICANCE_THRESHOLD = parseFloat(process.env.SIGNIFICANCE_THRESHOLD) || 0.1;
const MAX_SIGNIFICANCE = 10.0;
const MIN_SIGNIFICANCE = 0.1;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max requests per minute per user

// Enhanced blockchain setup
console.log('🔗 Connecting to blockchain...');
console.log('RPC URL:', process.env.RPC_URL);
console.log('Contract Address:', process.env.CONTRACT_ADDRESS);
console.log('Private Key Length:', process.env.RELAYER_PRIVATE_KEY?.length);

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
console.log('✅ Provider created');

const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
console.log('✅ Wallet created:', wallet.address);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  MetaTxInteraction.abi,
  wallet
);
console.log('✅ Contract connected');

// Rate limiting storage
const rateLimitStore = new Map();

// Interaction context storage for better AI validation
const interactionContexts = new Map();

console.log('🚀 Enhanced EIP-712 Ollama AI Relayer Service');
console.log('=============================================');
console.log(`🔗 Contract: ${process.env.CONTRACT_ADDRESS}`);
console.log(`🌐 Network: ${process.env.RPC_URL}`);
console.log(`🤖 AI Model: ${OLLAMA_MODEL}`);
console.log(`📊 Significance Threshold: ${SIGNIFICANCE_THRESHOLD}`);
console.log(`⚡ Rate Limit: ${RATE_LIMIT_MAX_REQUESTS} req/min per user`);
console.log(`🔗 Port: ${PORT}`);
console.log('');

// Middleware for rate limiting
function rateLimitMiddleware(req, res, next) {
  const userKey = req.ip + (req.body?.user || 'anonymous');
  const now = Date.now();
  
  if (!rateLimitStore.has(userKey)) {
    rateLimitStore.set(userKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const userData = rateLimitStore.get(userKey);
  
  if (now > userData.resetTime) {
    // Reset window
    rateLimitStore.set(userKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (userData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: userData.resetTime,
      maxRequests: RATE_LIMIT_MAX_REQUESTS
    });
  }
  
  userData.count++;
  next();
}

// Apply rate limiting to transaction endpoints
app.use('/relayMetaTx', rateLimitMiddleware);

// Health check endpoint with enhanced info
app.get('/health', async (req, res) => {
  try {
    // Check blockchain connectivity
    const blockNumber = await provider.getBlockNumber();
    const balance = await provider.getBalance(wallet.address);
    
    res.json({
      status: 'healthy',
      service: 'Enhanced EIP-712 Ollama AI Relayer',
      timestamp: new Date().toISOString(),
      blockchain: {
        connected: true,
        blockNumber: blockNumber,
        relayerBalance: ethers.formatEther(balance)
      },
      config: {
        ollamaUrl: OLLAMA_URL,
        model: OLLAMA_MODEL,
        port: PORT,
        threshold: SIGNIFICANCE_THRESHOLD,
        rateLimit: `${RATE_LIMIT_MAX_REQUESTS} req/min`
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced AI validation function with better context analysis
async function validateWithAI(interaction, userAddress, userHistory = null) {
  try {
    console.log(`🤖 Validating interaction with ${OLLAMA_MODEL}: "${interaction}"`);
    
    // Build context-aware prompt
    let contextInfo = '';
    if (userHistory) {
      contextInfo = `\nUser Context:
- Total interactions: ${userHistory.totalInteractions}
- Recent interaction types: ${userHistory.recentTypes?.join(', ') || 'None'}
- Last interaction: ${userHistory.lastInteraction || 'None'}`;
    }

    const prompt = `
You are an advanced AI content moderator for a decentralized social media platform that rewards positive interactions with tokens.

Analyze this user interaction and provide:
1. Safety assessment (approve/reject)
2. Significance score (0.1 to 10.0) - higher for more valuable social contributions
3. Detailed reasoning

Interaction: "${interaction}"
User Address: ${userAddress}${contextInfo}

SCORING GUIDELINES:
- Basic interactions (likes, simple reactions): 0.5-2.0
- Quality comments, shares: 2.0-5.0  
- Original content creation: 4.0-8.0
- Community building, educational content: 6.0-10.0
- Spam, low-effort, harmful content: 0.1-0.5 (reject)

Consider:
- Authenticity and effort level
- Potential value to community
- Frequency and pattern (avoid spam)
- Constructive vs. destructive nature

Respond in this EXACT format:
DECISION: [approve/reject]
SIGNIFICANCE: [0.1-10.0]
CATEGORY: [social_basic/content_creation/community_building/spam/harmful]
REASON: [detailed explanation of scoring rationale]
CONFIDENCE: [low/medium/high]
`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Lower temperature for more consistent scoring
          top_p: 0.8,
          num_predict: 300,
          stop: ['CONFIDENCE: high', 'CONFIDENCE: medium', 'CONFIDENCE: low']
        }
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Model '${OLLAMA_MODEL}' not found. Please check if the model is available in Ollama.`);
      }
      throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.response;
    
    console.log(`🤖 AI Response: ${aiResponse}`);

    // Enhanced parsing with better error handling
    const decisionMatch = aiResponse.match(/DECISION:\s*(approve|reject)/i);
    const significanceMatch = aiResponse.match(/SIGNIFICANCE:\s*([\d.]+)/);
    const categoryMatch = aiResponse.match(/CATEGORY:\s*([^\n]+)/i);
    const reasonMatch = aiResponse.match(/REASON:\s*([^\n]+)/i);
    const confidenceMatch = aiResponse.match(/CONFIDENCE:\s*(low|medium|high)/i);

    let decision = decisionMatch ? decisionMatch[1].toLowerCase() : 'reject';
    let significance = significanceMatch ? parseFloat(significanceMatch[1]) : 0.1;
    const category = categoryMatch ? categoryMatch[1].trim() : 'unknown';
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';
    const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'low';

    // Validate and clamp significance
    if (isNaN(significance) || significance < MIN_SIGNIFICANCE) {
      significance = MIN_SIGNIFICANCE;
    } else if (significance > MAX_SIGNIFICANCE) {
      significance = MAX_SIGNIFICANCE;
    }

    // Scale significance to contract format (multiply by 100 for 2 decimal precision)
    const scaledSignificance = Math.round(significance * 100);

    // Auto-reject if significance too low and confidence is high
    if (scaledSignificance < (SIGNIFICANCE_THRESHOLD * 100) && confidence === 'high') {
      decision = 'reject';
    }

    return {
      approved: decision === 'approve',
      significance: scaledSignificance,
      originalSignificance: significance,
      category: category,
      reason: reason,
      confidence: confidence,
      rawResponse: aiResponse
    };
  } catch (error) {
    console.error('❌ AI validation error:', error);
    return {
      approved: false,
      significance: Math.round(MIN_SIGNIFICANCE * 100),
      originalSignificance: MIN_SIGNIFICANCE,
      category: 'error',
      reason: `AI validation failed: ${error.message}`,
      confidence: 'low',
      error: error.message
    };
  }
}

// Enhanced fallback validation with pattern recognition
function enhancedFallbackValidation(interaction, userAddress) {
  console.log('🔄 Using enhanced fallback validation...');
  
  const interactionLower = interaction.toLowerCase();
  
  // Define interaction patterns with scoring
  const patterns = {
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
  };

  // Check patterns
  for (const [category, config] of Object.entries(patterns)) {
    for (const pattern of config.patterns) {
      if (interactionLower.includes(pattern)) {
        const scaledScore = Math.round(config.baseScore * 100);
        return {
          approved: config.approved,
          significance: scaledScore,
          originalSignificance: config.baseScore,
          category: category,
          reason: `Fallback: Matched ${category} pattern "${pattern}"`,
          confidence: 'medium',
          fallback: true
        };
      }
    }
  }

  // Default for unrecognized patterns
  return {
    approved: false,
    significance: Math.round(MIN_SIGNIFICANCE * 100),
    originalSignificance: MIN_SIGNIFICANCE,
    category: 'unknown',
    reason: 'Fallback: Unrecognized interaction pattern',
    confidence: 'low',
    fallback: true
  };
}

// Enhanced user history fetching
async function getUserHistory(userAddress) {
  try {
    const [totalInteractions, totalPoints] = await contract.getUserStats(userAddress);
    
    // Get recent interaction types (simplified - in production you'd want more sophisticated tracking)
    return {
      totalInteractions: parseInt(totalInteractions.toString()),
      totalPoints: parseInt(totalPoints.toString()),
      recentTypes: [], // Would need event parsing for real implementation
      lastInteraction: null
    };
  } catch (error) {
    console.error('❌ Error fetching user history:', error);
    return null;
  }
}

// Test validation endpoint with user context
app.post('/validate', async (req, res) => {
  const { interaction, userAddress } = req.body;
  
  if (!interaction) {
    return res.status(400).json({ error: 'Missing interaction parameter' });
  }

  const userHistory = userAddress ? await getUserHistory(userAddress) : null;
  const result = await validateWithAI(interaction, userAddress || 'unknown', userHistory);
  res.json(result);
});

// Get current nonce for a user
app.get('/nonce/:address', async (req, res) => {
  const { address } = req.params;
  
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  try {
    const nonce = await contract.nonces(address);
    console.log(`📊 Current nonce for ${address}: ${nonce}`);
    
    res.json({ 
      address: address,
      nonce: nonce.toString()
    });
  } catch (error) {
    console.error('❌ Error fetching nonce:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nonce',
      details: error.message
    });
  }
});

// Enhanced user stats endpoint
app.get('/user/:address/stats', async (req, res) => {
  const { address } = req.params;
  
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  try {
    const [totalInteractions, totalPoints, lastInteractionTime] = await contract.getUserStats(address);
    
    res.json({
      address: address,
      totalInteractions: totalInteractions.toString(),
      totalPoints: totalPoints.toString(),
      lastInteractionTime: lastInteractionTime.toString(),
      lastInteractionDate: new Date(parseInt(lastInteractionTime.toString()) * 1000).toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({
      error: 'Failed to fetch user stats',
      details: error.message
    });
  }
});

// Main enhanced relay endpoint
app.post('/relayMetaTx', async (req, res) => {
  const { user, interaction, nonce, signature } = req.body;
  
  console.log('📨 Received meta-transaction request:');
  console.log(`  User: ${user}`);
  console.log(`  Interaction: "${interaction}"`);
  console.log(`  Nonce: ${nonce}`);
  console.log(`  Signature: ${signature}`);

  // Validate required parameters
  if (!user || !interaction || nonce === undefined || !signature) {
    return res.status(400).json({ 
      error: 'Missing required parameters: user, interaction, nonce, signature' 
    });
  }

  // Validate user address format
  if (!ethers.isAddress(user)) {
    return res.status(400).json({ error: 'Invalid user address format' });
  }

  // Check if nonce matches the current contract nonce
  try {
    const currentNonce = await contract.nonces(user);
    console.log(`📊 Contract nonce for ${user}: ${currentNonce}, Provided nonce: ${nonce}`);
    
    if (BigInt(nonce) !== currentNonce) {
      return res.status(400).json({ 
        error: 'Nonce mismatch',
        expected: currentNonce.toString(),
        provided: nonce.toString(),
        suggestion: 'Please fetch the current nonce from the contract and retry'
      });
    }
  } catch (error) {
    console.error('❌ Error checking nonce:', error);
    return res.status(500).json({ 
      error: 'Failed to verify nonce',
      details: error.message
    });
  }

  // Get user history for context-aware validation
  const userHistory = await getUserHistory(user);

  // Enhanced AI validation with user context
  let validationResult;
  try {
    validationResult = await validateWithAI(interaction, user, userHistory);
    
    // If AI validation fails, use enhanced fallback
    if (validationResult.error) {
      validationResult = enhancedFallbackValidation(interaction, user);
    }
  } catch (error) {
    console.error('❌ Validation error:', error);
    validationResult = enhancedFallbackValidation(interaction, user);
  }

  console.log('🎯 Validation result:', validationResult);

  // Check if interaction is approved
  if (!validationResult.approved) {
    console.log('❌ Interaction rejected by AI validation');
    return res.status(400).json({ 
      error: 'Interaction rejected by AI validation',
      reason: validationResult.reason,
      category: validationResult.category,
      significance: validationResult.originalSignificance,
      confidence: validationResult.confidence
    });
  }

  // Check significance threshold (using scaled value)
  if (validationResult.significance < (SIGNIFICANCE_THRESHOLD * 100)) {
    console.log(`❌ Interaction significance too low: ${validationResult.originalSignificance} < ${SIGNIFICANCE_THRESHOLD}`);
    return res.status(400).json({ 
      error: 'Interaction significance below threshold',
      significance: validationResult.originalSignificance,
      threshold: SIGNIFICANCE_THRESHOLD,
      reason: validationResult.reason,
      category: validationResult.category
    });
  }

  // Execute enhanced meta-transaction
  try {
    console.log('📤 Sending transaction to contract...');
    console.log(`📊 Significance score: ${validationResult.significance} (${validationResult.originalSignificance})`);

    // Debug: Log transaction parameters
    console.log('🔍 Transaction Parameters:');
    console.log(`  User: ${user}`);
    console.log(`  Interaction: "${interaction}"`);
    console.log(`  Nonce: ${nonce}`);
    console.log(`  Significance: ${validationResult.significance}`);
    console.log(`  Signature: ${signature}`);
    
    // First, let's simulate the call to see if it would revert
    try {
      await contract.executeMetaTx.staticCall(
        user, 
        interaction, 
        nonce, 
        validationResult.significance,
        signature
      );
      console.log('✅ Static call successful - transaction should work');
    } catch (staticError) {
      console.error('❌ Static call failed - transaction will revert:', staticError.message);
      
      // Try to decode the revert reason
      if (staticError.data) {
        console.log('Revert data:', staticError.data);
      }
      
      return res.status(500).json({ 
        error: 'Transaction would revert',
        details: staticError.message,
        validation: validationResult,
        debugInfo: {
          user,
          interaction,
          nonce: nonce.toString(),
          significance: validationResult.significance,
          signatureLength: signature.length
        }
      });
    }

    const tx = await contract.executeMetaTx(
      user, 
      interaction, 
      nonce, 
      validationResult.significance, // Pass scaled significance to contract
      signature
    );
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed: ${tx.hash}`);
    
    res.json({ 
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      validation: {
        approved: validationResult.approved,
        significance: validationResult.originalSignificance,
        scaledSignificance: validationResult.significance,
        category: validationResult.category,
        reason: validationResult.reason,
        confidence: validationResult.confidence,
        fallback: validationResult.fallback || false
      },
      userStats: userHistory
    });
  } catch (error) {
    console.error('❌ Contract execution failed:', error);
    
    // Enhanced error logging
    console.log('🔍 Error Details:');
    console.log('  Error Code:', error.code);
    console.log('  Error Message:', error.message);
    console.log('  Transaction Hash:', error.receipt?.hash);
    console.log('  Gas Used:', error.receipt?.gasUsed?.toString());
    console.log('  Status:', error.receipt?.status);
    
    res.status(500).json({ 
      error: 'Contract execution failed',
      details: error.message,
      code: error.code,
      transactionHash: error.receipt?.hash,
      gasUsed: error.receipt?.gasUsed?.toString(),
      status: error.receipt?.status,
      validation: validationResult,
      debugInfo: {
        user,
        interaction,
        nonce: nonce.toString(),
        significance: validationResult.significance,
        signatureLength: signature.length
      }
    });
  }
});

// Debug endpoint to verify signature and transaction data
app.post('/debug', async (req, res) => {
  const { user, interaction, nonce, signature } = req.body;
  
  console.log('🔍 Debug endpoint called with:');
  console.log(`  User: ${user}`);
  console.log(`  Interaction: "${interaction}"`);
  console.log(`  Nonce: ${nonce}`);
  console.log(`  Signature: ${signature}`);

  try {
    // Validate inputs
    if (!user || !interaction || nonce === undefined || !signature) {
      return res.status(400).json({ 
        error: 'Missing required parameters: user, interaction, nonce, signature' 
      });
    }

    if (!ethers.isAddress(user)) {
      return res.status(400).json({ error: 'Invalid user address format' });
    }

    // Get contract nonce
    const contractNonce = await contract.nonces(user);
    console.log(`📊 Contract nonce: ${contractNonce}, Provided nonce: ${nonce}`);

    // Get domain separator from contract
    const domainSeparator = await contract.DOMAIN_SEPARATOR();
    console.log(`🔐 Domain separator: ${domainSeparator}`);

    // Get META_TX_TYPEHASH from contract  
    const metaTxTypeHash = await contract.META_TX_TYPEHASH();
    console.log(`📝 MetaTx TypeHash: ${metaTxTypeHash}`);

    // Reconstruct the message hash that should have been signed
    const domain = {
      name: "MetaTxInteraction",
      version: "1", 
      chainId: 202102,
      verifyingContract: process.env.CONTRACT_ADDRESS
    };

    const types = {
      MetaTx: [
        { name: "user", type: "address" },
        { name: "interaction", type: "string" },
        { name: "nonce", type: "uint256" }
      ]
    };

    const message = {
      user: user,
      interaction: interaction,
      nonce: nonce
    };

    // Compute the EIP-712 hash
    const messageHash = ethers.TypedDataEncoder.hash(domain, types, message);
    console.log(`🧮 Computed message hash: ${messageHash}`);

    // Try to recover the signer
    const recoveredSigner = ethers.verifyTypedData(domain, types, message, signature);
    console.log(`👤 Recovered signer: ${recoveredSigner}`);
    console.log(`✅ Signature valid: ${recoveredSigner.toLowerCase() === user.toLowerCase()}`);

    res.json({
      user,
      interaction,
      nonce: nonce.toString(),
      signature,
      contractNonce: contractNonce.toString(),
      nonceMatch: BigInt(nonce) === contractNonce,
      domainSeparator,
      metaTxTypeHash,
      messageHash,
      recoveredSigner,
      signatureValid: recoveredSigner.toLowerCase() === user.toLowerCase(),
      domain,
      types,
      message
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
  }
});

// Troubleshooting endpoint to check Ollama status
app.get('/ollama-status', async (req, res) => {
  try {
    // Check if Ollama is running
    const healthResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    
    if (!healthResponse.ok) {
      return res.status(500).json({
        status: 'error',
        message: 'Ollama API is not accessible',
        ollamaUrl: OLLAMA_URL,
        suggestions: [
          'Make sure Ollama is installed and running',
          'Check if the OLLAMA_URL is correct',
          'Try: ollama serve'
        ]
      });
    }

    const modelsData = await healthResponse.json();
    const availableModels = modelsData.models?.map(m => m.name) || [];
    
    // Check if the configured model is available
    const modelAvailable = availableModels.some(model => 
      model.includes(OLLAMA_MODEL) || OLLAMA_MODEL.includes(model.split(':')[0])
    );

    res.json({
      status: 'ok',
      ollamaUrl: OLLAMA_URL,
      configuredModel: OLLAMA_MODEL,
      modelAvailable: modelAvailable,
      availableModels: availableModels,
      suggestions: !modelAvailable ? [
        `Model '${OLLAMA_MODEL}' not found`,
        'Available models: ' + availableModels.join(', '),
        'Try: ollama pull ' + OLLAMA_MODEL,
        'Or update OLLAMA_MODEL environment variable to an available model'
      ] : ['All good! AI validation should work.']
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check Ollama status',
      error: error.message,
      ollamaUrl: OLLAMA_URL,
      suggestions: [
        'Make sure Ollama is installed and running',
        'Check if the OLLAMA_URL is correct',
        'Try: ollama serve'
      ]
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 EIP-712 Ollama AI Relayer running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test validation: POST http://localhost:${PORT}/validate`);
  console.log(`🚀 Relay endpoint: POST http://localhost:${PORT}/relayMetaTx`);
  console.log(`📊 Get nonce: GET http://localhost:${PORT}/nonce/:address`);
  console.log(`🔧 Ollama status: GET http://localhost:${PORT}/ollama-status`);
  console.log(`🔍 Debug endpoint: POST http://localhost:${PORT}/debug`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down EIP-712 Ollama AI Relayer...');
  process.exit(0);
});
