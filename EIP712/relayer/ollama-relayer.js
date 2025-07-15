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

// Configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const PORT = process.env.PORT || 3001;
const SIGNIFICANCE_THRESHOLD = parseFloat(process.env.SIGNIFICANCE_THRESHOLD) || 0.1;

// Blockchain setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  MetaTxInteraction.abi,
  wallet
);

console.log('🚀 EIP-712 Ollama AI Relayer Service');
console.log('===================================');
console.log(`🔗 Contract: ${process.env.CONTRACT_ADDRESS}`);
console.log(`🌐 Network: ${process.env.RPC_URL}`);
console.log(`🤖 AI Model: ${OLLAMA_MODEL}`);
console.log(`📊 Significance Threshold: ${SIGNIFICANCE_THRESHOLD}`);
console.log(`🔗 Port: ${PORT}`);
console.log('');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'EIP-712 Ollama AI Relayer',
    timestamp: new Date().toISOString(),
    config: {
      ollamaUrl: OLLAMA_URL,
      model: OLLAMA_MODEL,
      port: PORT,
      threshold: SIGNIFICANCE_THRESHOLD
    }
  });
});

// AI validation function
async function validateWithAI(interaction) {
  try {
    console.log(`🤖 Validating interaction with ${OLLAMA_MODEL}: "${interaction}"`);
    
    const prompt = `
You are an AI content moderator for a social media platform. Analyze this user interaction and determine:
1. Is it appropriate and safe? (approve/reject)
2. What is its significance level? (0.0 to 1.0)

Interaction: "${interaction}"

Respond in this exact format:
DECISION: [approve/reject]
SIGNIFICANCE: [0.0-1.0]
REASON: [brief explanation]

Only approve interactions that are:
- Positive social activities (likes, comments, shares, follows)
- Safe community engagement
- Not spam, harmful, or inappropriate content
`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: 200
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

    // Parse AI response
    const decisionMatch = aiResponse.match(/DECISION:\s*(approve|reject)/i);
    const significanceMatch = aiResponse.match(/SIGNIFICANCE:\s*([\d.]+)/);
    const reasonMatch = aiResponse.match(/REASON:\s*(.+)/i);

    const decision = decisionMatch ? decisionMatch[1].toLowerCase() : 'reject';
    const significance = significanceMatch ? parseFloat(significanceMatch[1]) : 0.0;
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

    return {
      approved: decision === 'approve',
      significance: significance,
      reason: reason,
      rawResponse: aiResponse
    };
  } catch (error) {
    console.error('❌ AI validation error:', error);
    return {
      approved: false,
      significance: 0.0,
      reason: `AI validation failed: ${error.message}`,
      error: error.message
    };
  }
}

// Fallback validation for when AI is not available
function fallbackValidation(interaction) {
  console.log('🔄 Using fallback validation...');
  
  const validPrefixes = [
    'liked_', 'comment_', 'share_', 'reshare_', 'post_',
    'community_post_', 'group_post_', 'reply_', 'vote_',
    'follow_', 'join_group_', 'leave_group_', 'bookmark_',
    'react_', 'mention_', 'tag_', 'create_', 'update_'
  ];

  const isValid = validPrefixes.some(prefix => interaction.startsWith(prefix));
  
  return {
    approved: isValid,
    significance: isValid ? 0.7 : 0.0,
    reason: isValid ? 'Matches valid interaction pattern' : 'Does not match valid interaction patterns',
    fallback: true
  };
}

// Test validation endpoint
app.post('/validate', async (req, res) => {
  const { interaction } = req.body;
  
  if (!interaction) {
    return res.status(400).json({ error: 'Missing interaction parameter' });
  }

  const result = await validateWithAI(interaction);
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

// Main relay endpoint
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

  // AI validation
  let validationResult;
  try {
    validationResult = await validateWithAI(interaction);
    
    // If AI validation fails, use fallback
    if (validationResult.error) {
      validationResult = fallbackValidation(interaction);
    }
  } catch (error) {
    console.error('❌ Validation error:', error);
    validationResult = fallbackValidation(interaction);
  }

  console.log('🎯 Validation result:', validationResult);

  // Check if interaction is approved
  if (!validationResult.approved) {
    console.log('❌ Interaction rejected by AI validation');
    return res.status(400).json({ 
      error: 'Interaction rejected by AI validation',
      reason: validationResult.reason,
      significance: validationResult.significance
    });
  }

  // Check significance threshold
  if (validationResult.significance < SIGNIFICANCE_THRESHOLD) {
    console.log(`❌ Interaction significance too low: ${validationResult.significance} < ${SIGNIFICANCE_THRESHOLD}`);
    return res.status(400).json({ 
      error: 'Interaction significance below threshold',
      significance: validationResult.significance,
      threshold: SIGNIFICANCE_THRESHOLD,
      reason: validationResult.reason
    });
  }

  // Execute meta-transaction
  try {
    console.log('📤 Sending transaction to contract...');

    const tx = await contract.executeMetaTx(user, interaction, nonce, signature);
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed: ${tx.hash}`);
    
    res.json({ 
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      validation: {
        approved: validationResult.approved,
        significance: validationResult.significance,
        reason: validationResult.reason,
        fallback: validationResult.fallback || false
      }
    });
  } catch (error) {
    console.error('❌ Contract execution failed:', error);
    res.status(500).json({ 
      error: 'Contract execution failed',
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
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down EIP-712 Ollama AI Relayer...');
  process.exit(0);
});
