const axios = require('axios');
const { ethers } = require('ethers');

/**
 * AI Validator using Ollama for social interaction validation
 */
class AIValidator {
    constructor(ollamaUrl = 'http://localhost:11434', model = 'llama3.2:3b') {
        this.ollamaUrl = ollamaUrl;
        this.model = model;
        this.interactionTypes = [
            'CREATE',     // 0 - Content creation
            'LIKES',      // 1 - Social engagement  
            'COMMENTS',   // 2 - Community interaction
            'TIPPING',    // 3 - Peer rewards
            'CRYPTO',     // 4 - Blockchain activity
            'REFERRALS'   // 5 - Network growth
        ];
        
        // Daily QOBI caps per interaction type
        this.dailyCaps = [
            ethers.parseEther('1.49'),  // CREATE
            ethers.parseEther('0.05'),  // LIKES
            ethers.parseEther('0.6'),   // COMMENTS
            ethers.parseEther('7.96'),  // TIPPING
            ethers.parseEther('9.95'),  // CRYPTO
            ethers.parseEther('11.95')  // REFERRALS
        ];
    }

    /**
     * Test Ollama connection
     */
    async testConnection() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`);
            console.log('✅ Ollama connection successful');
            console.log('Available models:', response.data.models?.map(m => m.name) || []);
            return true;
        } catch (error) {
            console.error('❌ Ollama connection failed:', error.message);
            console.log('Make sure Ollama is running: ollama serve');
            return false;
        }
    }

    /**
     * Ask Ollama to validate and score interactions
     * @param {Array} interactions - Raw interaction data
     * @param {number} interactionType - Type of interaction (0-5)
     * @returns {Array} Validated and scored interactions
     */
    async validateInteractions(interactions, interactionType) {
        const prompt = this.createValidationPrompt(interactions, interactionType);
        
        try {
            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    top_k: 20,
                    top_p: 0.9
                }
            });

            const aiResponse = response.data.response;
            return this.parseAIResponse(aiResponse, interactions, interactionType);
        } catch (error) {
            console.error('AI validation failed:', error.message);
            // Fallback to basic scoring
            return this.fallbackScoring(interactions, interactionType);
        }
    }

    /**
     * Create validation prompt for AI
     */
    createValidationPrompt(interactions, interactionType) {
        const typeName = this.interactionTypes[interactionType];
        
        return `You are an AI validator for a social mining platform called QOBI. Your task is to validate and score user interactions.

INTERACTION TYPE: ${typeName} (${interactionType})
SCORING RULES:
- Score each user from 0-100 points based on interaction quality
- Consider: authenticity, engagement level, community value, content quality
- Higher scores for genuine, valuable contributions
- Lower scores for spam, low-effort, or suspicious activity
- Points determine QOBI token allocation

INTERACTIONS TO VALIDATE:
${interactions.map((interaction, i) => 
    `${i+1}. User: ${interaction.user}
   Content: ${interaction.content || 'N/A'}
   Metadata: ${JSON.stringify(interaction.metadata || {})}
   `
).join('\n')}

RESPOND WITH ONLY JSON in this exact format:
{
  "validatedInteractions": [
    {"user": "0x...", "points": 85, "reason": "High quality content"},
    {"user": "0x...", "points": 45, "reason": "Low engagement"}
  ]
}

Validate all ${interactions.length} interactions. Be fair but strict.`;
    }

    /**
     * Parse AI response and convert to QOBI allocations
     */
    parseAIResponse(aiResponse, interactions, interactionType) {
        try {
            // Extract JSON from AI response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            const validatedUsers = [];
            const dailyCap = this.dailyCaps[interactionType];

            for (const validation of parsed.validatedInteractions) {
                if (validation.points > 0 && validation.points <= 100) {
                    // Calculate QOBI based on points and daily cap
                    const qobiAmount = (dailyCap * BigInt(validation.points)) / 100n;
                    
                    validatedUsers.push({
                        user: validation.user,
                        points: validation.points,
                        qobiAmount: qobiAmount.toString(),
                        reason: validation.reason,
                        interactionType
                    });
                }
            }

            console.log(`✅ AI validated ${validatedUsers.length}/${interactions.length} users for ${this.interactionTypes[interactionType]}`);
            return validatedUsers;

        } catch (error) {
            console.error('Failed to parse AI response:', error.message);
            console.log('AI Response:', aiResponse);
            return this.fallbackScoring(interactions, interactionType);
        }
    }

    /**
     * Fallback scoring when AI fails
     */
    fallbackScoring(interactions, interactionType) {
        console.log('🔄 Using fallback scoring algorithm');
        
        const validatedUsers = [];
        const dailyCap = this.dailyCaps[interactionType];

        for (const interaction of interactions) {
            // Simple scoring based on interaction characteristics
            let points = 50; // Base score
            
            // Adjust based on content length
            if (interaction.content) {
                if (interaction.content.length > 100) points += 20;
                if (interaction.content.length > 500) points += 15;
            }
            
            // Adjust based on engagement
            if (interaction.metadata?.engagement) {
                points += Math.min(interaction.metadata.engagement, 15);
            }
            
            // Add randomness to simulate AI variation
            points += Math.floor(Math.random() * 20) - 10;
            
            // Clamp to 0-100
            points = Math.max(0, Math.min(100, points));
            
            if (points > 0) {
                const qobiAmount = (dailyCap * BigInt(points)) / 100n;
                
                validatedUsers.push({
                    user: interaction.user,
                    points,
                    qobiAmount: qobiAmount.toString(),
                    reason: 'Algorithmic scoring',
                    interactionType
                });
            }
        }

        return validatedUsers;
    }

    /**
     * Get qualified users for a day and interaction type
     * @param {number} day - Day number
     * @param {number} interactionType - Interaction type
     * @returns {Array} Qualified user data
     */
    async getQualifiedUsers(day, interactionType) {
        // In a real system, this would fetch from database
        // For demo, we'll generate mock interactions
        const mockInteractions = this.generateMockInteractions(day, interactionType);
        
        console.log(`🤖 AI validating ${mockInteractions.length} interactions for ${this.interactionTypes[interactionType]} on day ${day}`);
        
        return await this.validateInteractions(mockInteractions, interactionType);
    }

    /**
     * Generate mock interactions for testing
     */
    generateMockInteractions(day, interactionType) {
        const userCount = Math.floor(Math.random() * 50) + 10; // 10-60 users
        const interactions = [];
        const typeName = this.interactionTypes[interactionType];

        for (let i = 0; i < userCount; i++) {
            // Generate random user address
            const user = ethers.Wallet.createRandom().address;
            
            // Generate interaction content based on type
            let content = '';
            let metadata = {};

            switch (interactionType) {
                case 0: // CREATE
                    content = `User created: "${this.generateContent('post')}"`;
                    metadata = { contentType: 'post', length: content.length };
                    break;
                case 1: // LIKES
                    content = `User liked ${Math.floor(Math.random() * 10) + 1} posts`;
                    metadata = { likesGiven: Math.floor(Math.random() * 10) + 1 };
                    break;
                case 2: // COMMENTS
                    content = `Comment: "${this.generateContent('comment')}"`;
                    metadata = { commentLength: content.length, replies: Math.floor(Math.random() * 5) };
                    break;
                case 3: // TIPPING
                    content = `Tipped ${ethers.parseEther((Math.random() * 0.1).toFixed(4))} ETH`;
                    metadata = { tipAmount: Math.random() * 0.1, recipients: Math.floor(Math.random() * 3) + 1 };
                    break;
                case 4: // CRYPTO
                    content = `DeFi interaction: ${['swap', 'stake', 'farm', 'lend'][Math.floor(Math.random() * 4)]}`;
                    metadata = { defiAction: content.split(': ')[1], gasUsed: Math.floor(Math.random() * 100000) + 21000 };
                    break;
                case 5: // REFERRALS
                    content = `Referred ${Math.floor(Math.random() * 5) + 1} new users`;
                    metadata = { referredCount: Math.floor(Math.random() * 5) + 1, conversionRate: Math.random() };
                    break;
            }

            interactions.push({
                user,
                content,
                metadata,
                timestamp: day * 86400 + Math.floor(Math.random() * 86400), // Random time in day
                interactionType
            });
        }

        return interactions;
    }

    /**
     * Generate realistic content
     */
    generateContent(type) {
        const postContent = [
            "Just discovered this amazing DeFi protocol! The yields are incredible 🚀",
            "Building the future of decentralized finance, one transaction at a time",
            "HODL strong! The fundamentals haven't changed 💎🙌",
            "New to crypto? Here's what you need to know about wallets and security",
            "Staking rewards are looking good this month! Time to compound"
        ];

        const commentContent = [
            "Great post! Thanks for sharing this insight",
            "I disagree, here's why...",
            "This changed my perspective completely",
            "Can you elaborate on this point?",
            "Love this community! 🔥"
        ];

        const content = type === 'post' ? postContent : commentContent;
        return content[Math.floor(Math.random() * content.length)];
    }
}

module.exports = { AIValidator };
