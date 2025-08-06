const axios = require('axios');

class AIValidator {
  constructor(ollamaUrl = 'http://localhost:11434', model = 'llama3.2:latest') {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
    this.validationHistory = [];
  }

  async validateTransaction(tx) {
    try {
      const prompt = this.createValidationPrompt(tx);
      const response = await this.queryOllama(prompt);
      
      const validation = this.parseValidationResponse(response);
      validation.txHash = this.generateTxHash(tx);
      validation.timestamp = Date.now();
      
      this.validationHistory.push(validation);
      return validation;
    } catch (error) {
      console.error('AI validation failed:', error);
      return this.createFallbackValidation(tx, error);
    }
  }

  createValidationPrompt(tx) {
    return `Analyze this blockchain transaction for security risks and anomalies:

Transaction Details:
- From: ${tx.from}
- To: ${tx.to}
- Value: ${tx.value} ETH
- Data: ${tx.data}
- Gas Limit: ${tx.gasLimit || 'not specified'}
- Gas Price: ${tx.gasPrice || 'not specified'}

Please evaluate:
1. Suspicious patterns in addresses
2. Unusual value transfers
3. Smart contract interaction risks
4. Known malicious patterns
5. Overall transaction safety

Respond with a JSON object containing:
{
  "riskScore": 0-100,
  "confidence": 0-100,
  "classification": "safe|suspicious|malicious",
  "warnings": ["array of warning messages"],
  "recommendations": ["array of recommendations"],
  "analysis": "detailed analysis text"
}`;
  }

  async queryOllama(prompt) {
    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1000
      }
    });

    return response.data.response;
  }

  parseValidationResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          validatorId: 'ollama-' + this.model,
          riskScore: Math.min(100, Math.max(0, parsed.riskScore || 50)),
          confidence: Math.min(100, Math.max(0, parsed.confidence || 70)),
          classification: parsed.classification || 'unknown',
          warnings: parsed.warnings || [],
          recommendations: parsed.recommendations || [],
          analysis: parsed.analysis || response.slice(0, 500),
          rawResponse: response
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
    }

    // Fallback parsing
    return this.createHeuristicValidation(response);
  }

  createHeuristicValidation(response) {
    const text = response.toLowerCase();
    let riskScore = 30; // Default medium-low risk
    let confidence = 60;
    let classification = 'unknown';
    const warnings = [];
    const recommendations = [];

    // Heuristic analysis based on keywords
    if (text.includes('malicious') || text.includes('dangerous') || text.includes('scam')) {
      riskScore += 40;
      classification = 'malicious';
      warnings.push('AI detected potentially malicious patterns');
    }
    
    if (text.includes('suspicious') || text.includes('unusual') || text.includes('anomaly')) {
      riskScore += 20;
      classification = classification === 'unknown' ? 'suspicious' : classification;
      warnings.push('Suspicious activity detected');
    }
    
    if (text.includes('safe') || text.includes('normal') || text.includes('legitimate')) {
      riskScore = Math.max(10, riskScore - 20);
      classification = classification === 'unknown' ? 'safe' : classification;
    }

    if (text.includes('high confidence') || text.includes('certain')) {
      confidence += 20;
    }

    return {
      validatorId: 'ollama-' + this.model + '-heuristic',
      riskScore: Math.min(100, riskScore),
      confidence: Math.min(100, confidence),
      classification,
      warnings,
      recommendations,
      analysis: response.slice(0, 500),
      rawResponse: response
    };
  }

  createFallbackValidation(tx, error) {
    return {
      validatorId: 'fallback-validator',
      riskScore: 50, // Medium risk when AI is unavailable
      confidence: 30, // Low confidence
      classification: 'unknown',
      warnings: ['AI validator unavailable - using fallback validation'],
      recommendations: ['Manual review recommended'],
      analysis: `Fallback validation due to error: ${error.message}`,
      error: error.message,
      timestamp: Date.now(),
      txHash: this.generateTxHash(tx)
    };
  }

  generateTxHash(tx) {
    const data = JSON.stringify({
      from: tx.from,
      to: tx.to,
      value: tx.value,
      data: tx.data
    });
    return '0x' + require('crypto').createHash('sha256').update(data).digest('hex');
  }

  async batchValidate(transactions) {
    const results = [];
    for (const tx of transactions) {
      const validation = await this.validateTransaction(tx);
      results.push(validation);
      
      // Small delay to avoid overwhelming the AI service
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return results;
  }

  getValidationStats() {
    if (this.validationHistory.length === 0) {
      return { message: 'No validations performed yet' };
    }

    const classifications = {};
    let totalRisk = 0;
    let totalConfidence = 0;

    this.validationHistory.forEach(v => {
      classifications[v.classification] = (classifications[v.classification] || 0) + 1;
      totalRisk += v.riskScore;
      totalConfidence += v.confidence;
    });

    return {
      totalValidations: this.validationHistory.length,
      averageRiskScore: totalRisk / this.validationHistory.length,
      averageConfidence: totalConfidence / this.validationHistory.length,
      classifications,
      recentValidations: this.validationHistory.slice(-10)
    };
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      return {
        connected: true,
        availableModels: response.data.models || [],
        currentModel: this.model
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        currentModel: this.model
      };
    }
  }
}

module.exports = AIValidator;
