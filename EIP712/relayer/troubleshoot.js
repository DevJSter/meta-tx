#!/usr/bin/env node

const axios = require('axios');

async function checkOllamaStatus() {
  console.log('🔍 Checking Ollama status...\n');
  
  try {
    const response = await axios.get('http://localhost:3001/ollama-status');
    const data = response.data;
    
    console.log(`📊 Status: ${data.status}`);
    console.log(`🔗 Ollama URL: ${data.ollamaUrl}`);
    console.log(`🤖 Configured Model: ${data.configuredModel}`);
    console.log(`✅ Model Available: ${data.modelAvailable}`);
    
    if (data.availableModels && data.availableModels.length > 0) {
      console.log(`📋 Available Models: ${data.availableModels.join(', ')}`);
    }
    
    if (data.suggestions && data.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      data.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Relayer responded with error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to relayer. Make sure it\'s running on port 3001');
      console.error('   Try: cd relayer && npm start');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

async function testNonce() {
  console.log('\n🔢 Testing nonce endpoint...\n');
  
  const testAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  
  try {
    const response = await axios.get(`http://localhost:3001/nonce/${testAddress}`);
    console.log(`✅ Nonce for ${testAddress}: ${response.data.nonce}`);
  } catch (error) {
    if (error.response) {
      console.error('❌ Nonce endpoint error:', error.response.data);
    } else {
      console.error('❌ Cannot test nonce endpoint:', error.message);
    }
  }
}

async function testValidation() {
  console.log('\n🧪 Testing validation endpoint...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/validate', {
      interaction: 'share_post-test'
    });
    
    console.log('✅ Validation result:');
    console.log(`   Approved: ${response.data.approved}`);
    console.log(`   Significance: ${response.data.significance}`);
    console.log(`   Reason: ${response.data.reason}`);
    if (response.data.fallback) {
      console.log('   ⚠️  Using fallback validation (AI not available)');
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Validation endpoint error:', error.response.data);
    } else {
      console.error('❌ Cannot test validation endpoint:', error.message);
    }
  }
}

async function main() {
  console.log('🔧 EIP-712 Ollama AI Relayer Troubleshooting Tool');
  console.log('=================================================\n');
  
  await checkOllamaStatus();
  await testNonce();
  await testValidation();
  
  console.log('\n✨ Troubleshooting complete!');
}

main().catch(console.error);
