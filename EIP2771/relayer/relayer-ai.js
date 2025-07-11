const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');

const app = express();
app.use(express.json());

// Configuration
const RPC_URL = 'http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc';
const CHAIN_ID = 930393;
const RELAYER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Update these with your deployed contract addresses
const FORWARDER_ADDRESS = '0x9A676e781A523b5d0C0e43731313A708CB607508';
const RECIPIENT_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

// Ollama Configuration
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.2:latest';

// Significance thresholds (0.0 - 1.0)
const APPROVAL_THRESHOLD = 0.7; // Above this = approve
const REJECTION_THRESHOLD = 0.3; // Below this = reject

console.log('🤖 EIP-2771 Ollama AI Validation Service');
console.log('=======================================');
console.log(`Forwarder: ${FORWARDER_ADDRESS}`);
console.log(`Recipient: ${RECIPIENT_ADDRESS}`);
console.log(`RPC: ${RPC_URL}`);
console.log(`Ollama Model: ${OLLAMA_MODEL}`);
console.log(`Approval Threshold: ${APPROVAL_THRESHOLD}`);
console.log(`Rejection Threshold: ${REJECTION_THRESHOLD}`);

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

// Contract ABIs
const forwarderABI = [
    'function nonces(address owner) external view returns (uint256)',
    'function executeWithAIResult((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature), bool aiApproved, uint256 significance) external payable',
    'function verify((address from, address to, uint256 value, uint256 gas, uint48 deadline, bytes data, bytes signature)) external view returns (bool)',
    'function setAIValidator(address validator) external'
];

const recipientABI = [
    'function executeInteraction(string memory interaction) external',
    'function getUserInteractionCount(address user) external view returns (uint256)',
    'function getLatestInteraction(address user) external view returns (string)'
];

const forwarderContract = new ethers.Contract(FORWARDER_ADDRESS, forwarderABI, relayerWallet);
const recipientContract = new ethers.Contract(RECIPIENT_ADDRESS, recipientABI, provider);

// AI Validation using Ollama
async function validateWithOllama(interaction) {
    console.log(`🧠 Validating interaction with Ollama: "${interaction}"`);
    
    const prompt = `
You are an AI content moderator for a social platform. Analyze this user interaction and respond with ONLY a JSON object.

Interaction: "${interaction}"

Provide your response as a JSON object with these exact fields:
{
  "approved": true/false,
  "significance": 0.0-1.0,
  "reasoning": "brief explanation",
  "category": "positive/negative/neutral/spam/harmful"
}

Rules:
- significance 0.8-1.0: High confidence (approve/reject)
- significance 0.3-0.7: Medium confidence (needs review)
- significance 0.0-0.3: Low confidence (reject)

Approve interactions that are:
- Positive social interactions (like, comment, share)
- Constructive feedback
- Normal social platform behavior

Reject interactions that are:
- Spam or repetitive content
- Harmful, offensive, or abusive content
- Suspicious or malicious patterns
- Empty or invalid content

Respond with ONLY the JSON object, no other text.`;

    try {
        console.log('📡 Calling Ollama API...');
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.1,
                top_p: 0.9,
                num_ctx: 2048
            }
        });

        console.log('🔍 Raw Ollama response:', response.data.response.substring(0, 200) + '...');
        
        // Try to extract JSON from response
        let jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.log('⚠️  No JSON found in response, falling back to basic validation');
            return basicValidation(interaction);
        }

        const result = JSON.parse(jsonMatch[0]);
        
        console.log('✅ Parsed AI validation result:', result);
        
        // Validate the response structure
        if (typeof result.approved !== 'boolean' || 
            typeof result.significance !== 'number' ||
            result.significance < 0 || result.significance > 1) {
            console.log('⚠️  Invalid AI response structure, falling back to basic validation');
            return basicValidation(interaction);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Ollama validation failed:', error.message);
        console.log('🔄 Falling back to basic validation');
        return basicValidation(interaction);
    }
}

// Fallback basic validation
function basicValidation(interaction) {
    const validPrefixes = ['liked_', 'comment_', 'share_', 'follow_', 'view_', 'bookmark_'];
    const invalidPatterns = ['spam', 'hack', 'exploit', 'scam', 'phishing'];
    
    const lowerInteraction = interaction.toLowerCase();
    
    // Check for harmful patterns
    for (const pattern of invalidPatterns) {
        if (lowerInteraction.includes(pattern)) {
            return {
                approved: false,
                significance: 0.9,
                reasoning: `Contains potentially harmful pattern: ${pattern}`,
                category: 'harmful'
            };
        }
    }
    
    // Check for valid prefixes
    for (const prefix of validPrefixes) {
        if (lowerInteraction.startsWith(prefix)) {
            return {
                approved: true,
                significance: 0.8,
                reasoning: `Valid social interaction pattern: ${prefix}`,
                category: 'positive'
            };
        }
    }
    
    // Default to neutral with medium significance
    return {
        approved: false,
        significance: 0.5,
        reasoning: 'Unknown interaction pattern, requires review',
        category: 'neutral'
    };
}

// Make final decision based on AI result and significance thresholds
function makeFinalDecision(aiResult) {
    if (aiResult.significance >= APPROVAL_THRESHOLD && aiResult.approved) {
        return { decision: 'APPROVED', reasoning: `High confidence approval (${aiResult.significance})` };
    }
    
    if (aiResult.significance >= APPROVAL_THRESHOLD && !aiResult.approved) {
        return { decision: 'REJECTED', reasoning: `High confidence rejection (${aiResult.significance})` };
    }
    
    if (aiResult.significance <= REJECTION_THRESHOLD) {
        return { decision: 'REJECTED', reasoning: `Low confidence, defaulting to rejection (${aiResult.significance})` };
    }
    
    // Medium significance - use AI decision
    return { 
        decision: aiResult.approved ? 'APPROVED' : 'REJECTED', 
        reasoning: `Medium confidence decision (${aiResult.significance})` 
    };
}

// Extract interaction from calldata
function extractInteraction(calldata) {
    try {
        // For executeInteraction(string) function
        const iface = new ethers.Interface(recipientABI);
        const decoded = iface.parseTransaction({ data: calldata });
        
        if (decoded && decoded.name === 'executeInteraction') {
            return decoded.args[0]; // First argument is the interaction string
        }
        
        return '';
    } catch (error) {
        console.error('Error extracting interaction:', error.message);
        return '';
    }
}

// EIP-2771 Meta-transaction endpoint with AI validation
app.post('/validateAndRelay', async (req, res) => {
    console.log('\n🚀 New EIP-2771 meta-transaction request received');
    
    try {
        const { request } = req.body;
        
        console.log(`👤 User: ${request.from}`);
        console.log(`🎯 Target: ${request.to}`);
        console.log(`🔢 Nonce: ${request.nonce}`);
        
        // Step 1: Extract interaction from calldata
        const interaction = extractInteraction(request.data);
        console.log(`💬 Interaction: ${interaction}`);
        
        if (!interaction) {
            return res.status(400).json({
                error: 'Could not extract interaction from calldata',
                significance: 0.0
            });
        }
        
        // Step 2: AI Validation
        const aiResult = await validateWithOllama(interaction);
        const decision = makeFinalDecision(aiResult);
        
        console.log(`🎯 AI Decision: ${decision.decision}`);
        console.log(`📊 Significance: ${aiResult.significance}`);
        console.log(`💭 AI Reasoning: ${aiResult.reasoning}`);
        console.log(`🏷️  Category: ${aiResult.category}`);
        console.log(`⚖️  Final Reasoning: ${decision.reasoning}`);
        
        if (decision.decision === 'REJECTED') {
            return res.status(400).json({
                error: 'Transaction rejected by AI validation',
                aiResult: aiResult,
                decision: decision,
                significance: aiResult.significance
            });
        }
        
        // Step 3: Execute with AI result
        console.log('📤 Executing meta-transaction with AI validation...');
        
        const fullRequest = {
            from: request.from,
            to: request.to,
            value: request.value || 0,
            gas: request.gas || 100000,
            deadline: request.deadline,
            data: request.data,
            signature: request.signature
        };
        
        // Convert significance to basis points (0-10000)
        const significanceBasisPoints = Math.floor(aiResult.significance * 10000);
        
        const tx = await forwarderContract.executeWithAIResult(
            fullRequest,
            aiResult.approved,
            significanceBasisPoints
        );
        
        console.log(`🎉 Transaction submitted: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`⛽ Gas used: ${receipt.gasUsed}`);
        
        res.json({
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            aiResult: aiResult,
            decision: decision,
            interaction: interaction
        });
        
    } catch (error) {
        console.error('❌ Error processing meta-transaction:', error);
        res.status(500).json({
            error: error.message,
            significance: 0.0
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check Ollama connection
        const ollamaResponse = await axios.get(`${OLLAMA_URL}/api/tags`);
        const models = ollamaResponse.data.models || [];
        const modelExists = models.some(model => model.name.includes(OLLAMA_MODEL));
        
        res.json({
            status: 'healthy',
            forwarder: FORWARDER_ADDRESS,
            recipient: RECIPIENT_ADDRESS,
            rpc: RPC_URL,
            ollama: {
                connected: true,
                url: OLLAMA_URL,
                model: OLLAMA_MODEL,
                modelAvailable: modelExists,
                availableModels: models.map(m => m.name)
            },
            thresholds: {
                approval: APPROVAL_THRESHOLD,
                rejection: REJECTION_THRESHOLD
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            ollama: {
                connected: false,
                url: OLLAMA_URL
            }
        });
    }
});

// Test AI validation endpoint
app.post('/testValidation', async (req, res) => {
    try {
        const { interaction } = req.body;
        const aiResult = await validateWithOllama(interaction);
        const decision = makeFinalDecision(aiResult);
        
        res.json({
            interaction,
            aiResult,
            decision
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🌐 EIP-2771 AI Validation Service running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test validation: POST http://localhost:${PORT}/testValidation`);
    console.log(`🚀 Validate & Relay: POST http://localhost:${PORT}/validateAndRelay\n`);
});
