const express = require('express');
const ethers = require('ethers');
const config = require('../config/env');
const MetaTxInteraction = require('./MetaTxInteraction.json');

// Use global fetch if available (Node.js v18+), otherwise fallback to node-fetch
let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch {
  fetch = require('node-fetch');
}

const app = express();
app.use(express.json());

// Use centralized configuration
const {
  blockchain,
  wallet: walletConfig,
  eip712,
  ollama,
  server,
  validation,
  interactions,
  debug,
  helpers
} = config;

const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl, blockchain.networkConfig);

// Override provider methods to prevent ENS resolution
provider.resolveName = async (name) => {
  if (ethers.isAddress(name)) {
    return name;
  }
  throw new Error('ENS resolution is disabled for this network');
};

// Also override resolveAddress to bypass the internal resolution
provider.resolveAddress = async (address) => {
  if (ethers.isAddress(address)) {
    return address;
  }
  throw new Error('ENS resolution is disabled for this network');
};

console.log('✅ Provider created');

const wallet = new ethers.Wallet(walletConfig.relayerPrivateKey, provider);
console.log('✅ Wallet created:', wallet.address);

const contract = new ethers.Contract(
  blockchain.contractAddress,
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
console.log(`🔗 Contract: ${blockchain.contractAddress}`);
console.log(`🌐 Network: ${blockchain.rpcUrl}`);
console.log(`🤖 AI Model: ${ollama.model}`);
console.log(`📊 Significance Threshold: ${validation.significanceThreshold}`);
console.log(`⚡ Rate Limit: ${validation.rateLimitMaxRequests} req/min per user`);
console.log(`🎯 Reject Low Confidence: ${validation.rejectLowConfidence}`);
console.log(`🔗 Port: ${server.port}`);
console.log('');

// Middleware for rate limiting
function rateLimitMiddleware(req, res, next) {
  const userKey = req.ip + (req.body?.user || 'anonymous');
  const now = Date.now();
  
  if (!rateLimitStore.has(userKey)) {
    rateLimitStore.set(userKey, { count: 1, resetTime: now + validation.rateLimitWindow });
    return next();
  }
  
  const userData = rateLimitStore.get(userKey);
  
  if (now > userData.resetTime) {
    // Reset window
    rateLimitStore.set(userKey, { count: 1, resetTime: now + validation.rateLimitWindow });
    return next();
  }
  
  if (userData.count >= validation.rateLimitMaxRequests) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: userData.resetTime,
      maxRequests: validation.rateLimitMaxRequests
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
        ollamaUrl: ollama.url,
        model: ollama.model,
        port: server.port,
        threshold: validation.significanceThreshold,
        rateLimit: `${validation.rateLimitMaxRequests} req/min`
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
    console.log(`🤖 Validating interaction with ${ollama.model}: "${interaction}"`);
    
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

CRITICAL: Only HIGH confidence interactions should reach the blockchain to prevent failed transactions.

Analyze this user interaction and provide:
1. Safety assessment (approve/reject)
2. Significance score (0.1 to 10.0) - higher for more valuable social contributions
3. Detailed reasoning

Interaction: "${interaction}"
User Address: ${userAddress}${contextInfo}

CONFIDENCE CRITERIA (VERY STRICT):
- HIGH: Clear, meaningful, specific interactions that obviously add value
- MEDIUM: Decent interactions but lacking specificity or unclear value
- LOW: Vague, generic, unclear, or potentially spam interactions

SCORING GUIDELINES:
- Basic interactions (likes, simple reactions): 0.5-2.0
- Quality comments, shares: 2.0-5.0  
- Original content creation: 4.0-8.0
- Community building, educational content: 6.0-10.0
- Spam, low-effort, harmful content: 0.1-0.5 (reject)

EXAMPLES OF CONFIDENCE LEVELS:
HIGH confidence:
- "create_post-comprehensive_guide_to_smart_contract_security"
- "comment-excellent_analysis_of_defi_risks_thanks_for_detailed_breakdown"
- "share_research-blockchain_scalability_solutions_2024_report"

MEDIUM confidence:
- "comment-interesting_post_thanks"
- "like_good_content"
- "follow_blockchain_expert"

LOW confidence (WILL BE REJECTED):
- "like_post"
- "good"
- "nice"
- "test"
- Generic or unclear interactions

Consider:
- Specificity and detail level
- Clear value proposition
- Professional/meaningful language
- Authentic human interaction vs automated/spam

Respond in this EXACT format:
DECISION: [approve/reject]
SIGNIFICANCE: [0.1-10.0]
CATEGORY: [social_basic/content_creation/community_building/spam/harmful]
REASON: [detailed explanation of scoring rationale]
CONFIDENCE: [low/medium/high]
`;

    const response = await fetch(`${ollama.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollama.model,
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
        throw new Error(`Model '${ollama.model}' not found. Please check if the model is available in Ollama.`);
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
    if (isNaN(significance) || significance < validation.minSignificance) {
      significance = validation.minSignificance;
    } else if (significance > validation.maxSignificance) {
      significance = validation.maxSignificance;
    }

    // Scale significance to contract format (multiply by 100 for 2 decimal precision)
    const scaledSignificance = helpers.getScaledSignificance(significance);

    // Auto-reject if significance too low and confidence is high
    if (scaledSignificance < (validation.significanceThreshold * 100) && confidence === 'high') {
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
      significance: helpers.getScaledSignificance(validation.minSignificance),
      originalSignificance: validation.minSignificance,
      category: 'error',
      reason: `AI validation failed: ${error.message}`,
      confidence: 'low',
      error: error.message
    };
  }
}

// Enhanced fallback validation with pattern recognition (CONSERVATIVE)
function enhancedFallbackValidation(interaction, userAddress) {
  console.log('🔄 Using enhanced fallback validation (conservative mode)...');
  
  const interactionLower = interaction.toLowerCase();
  
  // Use centralized interaction patterns
  const patterns = interactions.patterns;

  // Check patterns - BUT be more conservative with confidence
  for (const [category, config] of Object.entries(patterns)) {
    for (const pattern of config.patterns) {
      if (interactionLower.includes(pattern)) {
        const scaledScore = helpers.getScaledSignificance(config.baseScore);
        return {
          approved: config.approved && config.baseScore >= 2.0, // Only approve if score is decent
          significance: scaledScore,
          originalSignificance: config.baseScore,
          category: category,
          reason: `Fallback: Matched ${category} pattern "${pattern}" - conservative approval`,
          confidence: 'low', // Always low confidence for fallback
          fallback: true
        };
      }
    }
  }

  // Default for unrecognized patterns - ALWAYS LOW CONFIDENCE
  return {
    approved: false,
    significance: helpers.getScaledSignificance(validation.minSignificance),
    originalSignificance: validation.minSignificance,
    category: 'unknown',
    reason: 'Fallback: Unrecognized interaction pattern - please provide more descriptive interaction',
    confidence: 'low',
    fallback: true
  };
}

// Enhanced user history fetching
async function getUserHistory(userAddress) {
  try {
    // Use direct RPC call to bypass ENS resolution
    const statsData = contract.interface.encodeFunctionData('getUserStats', [userAddress]);
    const result = await provider.call({
      to: ethers.getAddress(blockchain.contractAddress), // Ensure proper address format
      data: statsData
    });
    const [totalInteractions, totalSignificancePoints, lastInteractionTimestamp] = contract.interface.decodeFunctionResult('getUserStats', result);
    
    // Get recent interaction types (simplified - in production you'd want more sophisticated tracking)
    return {
      totalInteractions: parseInt(totalInteractions.toString()),
      totalPoints: parseInt(totalSignificancePoints.toString()),
      lastInteractionTime: parseInt(lastInteractionTimestamp.toString()),
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
    // Use raw JSON-RPC call to completely bypass ethers address resolution
    const nonceData = contract.interface.encodeFunctionData('nonces', [address]);
    
    // Use the actual deployed contract address from centralized config
    const contractAddress = blockchain.contractAddress;
    console.log(`🔍 Debug: Contract address: "${contractAddress}", length: ${contractAddress.length}`);
    console.log(`🔍 Debug: Address chars:`, contractAddress.split('').map((c, i) => `${i}:'${c}'`).join(' '));
    console.log(`🔍 Debug: Nonce data: ${nonceData}`);
    
    const response = await fetch(blockchain.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: nonceData
        }, 'latest'],
        id: 1
      })
    });
    
    const rpcResult = await response.json();
    if (rpcResult.error) {
      throw new Error(`RPC Error: ${rpcResult.error.message}`);
    }
    
    const nonce = contract.interface.decodeFunctionResult('nonces', rpcResult.result)[0];
    
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
    // Use direct RPC call to bypass ENS resolution
    const statsData = contract.interface.encodeFunctionData('getUserStats', [address]);
    const result = await provider.call({
      to: ethers.getAddress(blockchain.contractAddress), // Ensure proper address format
      data: statsData
    });
    const [totalInteractions, totalSignificancePoints, lastInteractionTimestamp] = contract.interface.decodeFunctionResult('getUserStats', result);
    
    res.json({
      address: address,
      totalInteractions: totalInteractions.toString(),
      totalPoints: totalSignificancePoints.toString(),
      lastInteractionTime: lastInteractionTimestamp.toString(),
      lastInteractionDate: lastInteractionTimestamp.toString() !== '0' 
        ? new Date(parseInt(lastInteractionTimestamp.toString()) * 1000).toISOString()
        : null
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
    // Use direct RPC call to bypass ENS resolution
    const nonceData = contract.interface.encodeFunctionData('nonces', [user]);
    const result = await provider.call({
      to: ethers.getAddress(blockchain.contractAddress), // Ensure proper address format
      data: nonceData
    });
    const currentNonce = contract.interface.decodeFunctionResult('nonces', result)[0];
    
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

  // STRICT: Always reject low confidence transactions to prevent failed transactions on blockchain
  if (validationResult.confidence === 'low') {
    console.log('❌ Interaction rejected due to low AI confidence - preventing blockchain spam');
    return res.status(400).json({ 
      error: 'Interaction rejected due to low AI confidence',
      reason: validationResult.reason,
      category: validationResult.category,
      significance: validationResult.originalSignificance,
      confidence: validationResult.confidence,
      suggestion: 'Please provide a clearer, more detailed, and meaningful interaction description',
      note: 'Low confidence transactions are blocked to prevent failed transactions on the blockchain explorer'
    });
  }

  // Additional check: Only allow high confidence transactions for contract execution
  if (validationResult.confidence !== 'high') {
    console.log('❌ Interaction requires high confidence for blockchain execution');
    return res.status(400).json({ 
      error: 'Only high confidence interactions are allowed for blockchain execution',
      reason: validationResult.reason,
      category: validationResult.category,
      significance: validationResult.originalSignificance,
      confidence: validationResult.confidence,
      suggestion: 'Please provide a more specific and meaningful interaction that clearly demonstrates value to the community'
    });
  }

  // Check significance threshold (using scaled value)
  if (validationResult.significance < (validation.significanceThreshold * 100)) {
    console.log(`❌ Interaction significance too low: ${validationResult.originalSignificance} < ${validation.significanceThreshold}`);
    return res.status(400).json({ 
      error: 'Interaction significance below threshold',
      significance: validationResult.originalSignificance,
      threshold: validation.significanceThreshold,
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
    
    // Enhanced static call validation with better error detection
    try {
      console.log('🔍 Performing enhanced static call validation...');
      
      // Perform the static call to validate the transaction
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
      console.error('❌ Static call error details:', staticError);
      
      // Enhanced error analysis
      let errorReason = 'Unknown revert reason';
      let errorCategory = 'unknown';
      
      if (staticError.message.includes('signature') || staticError.message.includes('Invalid signature')) {
        errorReason = 'Invalid signature or signature verification failed';
        errorCategory = 'signature_error';
      } else if (staticError.message.includes('nonce') || staticError.message.includes('Invalid nonce')) {
        errorReason = 'Nonce mismatch or nonce already used';
        errorCategory = 'nonce_error';
      } else if (staticError.message.includes('insufficient')) {
        errorReason = 'Insufficient balance or allowance';
        errorCategory = 'balance_error';
      } else if (staticError.message.includes('cooldown')) {
        errorReason = 'Interaction is on cooldown period';
        errorCategory = 'cooldown_error';
      } else if (staticError.message.includes('significance')) {
        errorReason = 'Invalid significance value';
        errorCategory = 'significance_error';
      } else if (staticError.data) {
        console.log('🔍 Revert data:', staticError.data);
        errorReason = `Contract revert with data: ${staticError.data}`;
        errorCategory = 'contract_revert';
      }
      
      return res.status(400).json({ 
        error: 'Transaction simulation failed - would revert on blockchain',
        reason: errorReason,
        category: errorCategory,
        details: staticError.message,
        validation: validationResult,
        debugInfo: {
          user,
          interaction,
          nonce: nonce.toString(),
          significance: validationResult.significance,
          signatureLength: signature.length,
          staticCallError: staticError.code || 'UNKNOWN'
        }
      });
    }

    // Final pre-execution validation
    console.log('🔄 Performing final pre-execution checks...');
    
    // Verify relayer has sufficient balance for gas
    const relayerBalance = await provider.getBalance(wallet.address);
    const estimatedGasLimit = validation.estimatedGasLimit; // Conservative estimate
    const gasPrice = (await provider.getFeeData()).gasPrice || validation.defaultGasPrice;
    const estimatedGasCost = estimatedGasLimit * gasPrice;
    
    if (relayerBalance < estimatedGasCost) {
      console.error('❌ Relayer has insufficient balance for gas');
      return res.status(500).json({ 
        error: 'Relayer insufficient balance',
        details: 'The relayer does not have enough ETH to pay for gas',
        relayerBalance: ethers.formatEther(relayerBalance),
        estimatedGasCost: ethers.formatEther(estimatedGasCost)
      });
    }

    const tx = await contract.executeMetaTx(
      user, 
      interaction, 
      nonce, 
      validationResult.significance, // Pass scaled significance to contract
      signature,
      {
        gasLimit: estimatedGasLimit // Set explicit gas limit
      }
    );
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    // Wait for transaction with timeout
    let receipt;
    try {
      receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), validation.transactionTimeout)
        )
      ]);
    } catch (waitError) {
      console.error('❌ Transaction wait failed:', waitError);
      
      if (waitError.message === 'Transaction timeout') {
        return res.status(408).json({ 
          error: 'Transaction timeout',
          details: 'Transaction was sent but confirmation timed out',
          txHash: tx.hash,
          validation: validationResult
        });
      }
      
      // Check if transaction was mined but reverted
      try {
        const txReceipt = await provider.getTransactionReceipt(tx.hash);
        if (txReceipt && txReceipt.status === 0) {
          console.error('❌ Transaction was mined but reverted');
          return res.status(400).json({ 
            error: 'Transaction reverted on blockchain',
            details: 'Transaction was mined but execution failed',
            txHash: tx.hash,
            blockNumber: txReceipt.blockNumber,
            gasUsed: txReceipt.gasUsed.toString(),
            validation: validationResult
          });
        }
      } catch (receiptError) {
        console.error('❌ Could not fetch transaction receipt:', receiptError);
      }
      
      throw waitError;
    }
    
    // Verify transaction was successful
    if (receipt.status === 0) {
      console.error('❌ Transaction mined but reverted');
      return res.status(400).json({ 
        error: 'Transaction reverted after mining',
        details: 'Transaction was included in a block but execution failed',
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        validation: validationResult
      });
    }
    
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
    const nonceData = contract.interface.encodeFunctionData('nonces', [user]);
    const nonceResult = await provider.call({
      to: ethers.getAddress(blockchain.contractAddress), // Ensure proper address format
      data: nonceData
    });
    const contractNonce = contract.interface.decodeFunctionResult('nonces', nonceResult)[0];
    console.log(`📊 Contract nonce: ${contractNonce}, Provided nonce: ${nonce}`);

    // Get domain separator from contract
    const domainSeparator = await contract.DOMAIN_SEPARATOR();
    console.log(`🔐 Domain separator: ${domainSeparator}`);

    // Get META_TX_TYPEHASH from contract  
    const metaTxTypeHash = await contract.META_TX_TYPEHASH();
    console.log(`📝 MetaTx TypeHash: ${metaTxTypeHash}`);

    // Reconstruct the message hash that should have been signed
    const domain = eip712.domain;
    const types = eip712.types;

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
    const healthResponse = await fetch(`${ollama.url}/api/tags`);
    
    if (!healthResponse.ok) {
      return res.status(500).json({
        status: 'error',
        message: 'Ollama API is not accessible',
        ollamaUrl: ollama.url,
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
      model.includes(ollama.model) || ollama.model.includes(model.split(':')[0])
    );

    res.json({
      status: 'ok',
      ollamaUrl: ollama.url,
      configuredModel: ollama.model,
      modelAvailable: modelAvailable,
      availableModels: availableModels,
      suggestions: !modelAvailable ? [
        `Model '${ollama.model}' not found`,
        'Available models: ' + availableModels.join(', '),
        'Try: ollama pull ' + ollama.model,
        'Or update OLLAMA_MODEL environment variable to an available model'
      ] : ['All good! AI validation should work.']
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to check Ollama status',
      error: error.message,
      ollamaUrl: ollama.url,
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
app.listen(server.port, () => {
  console.log(`🌐 EIP-712 Ollama AI Relayer running on port ${server.port}`);
  console.log(`📝 Health check: http://localhost:${server.port}/health`);
  console.log(`🧪 Test validation: POST http://localhost:${server.port}/validate`);
  console.log(`🚀 Relay endpoint: POST http://localhost:${server.port}/relayMetaTx`);
  console.log(`📊 Get nonce: GET http://localhost:${server.port}/nonce/:address`);
  console.log(`🔧 Ollama status: GET http://localhost:${server.port}/ollama-status`);
  console.log(`🔍 Debug endpoint: POST http://localhost:${server.port}/debug`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down EIP-712 Ollama AI Relayer...');
  process.exit(0);
});
