# EIP-712 Ollama AI Relayer - Troubleshooting Guide

## Common Issues and Solutions

### 1. Ollama Model Not Found (404 Error)

**Problem:** You see `❌ AI validation error: Error: Ollama API error: 404`

**Solutions:**

1. **Check if Ollama is running:**
   ```bash
   ollama serve
   ```

2. **Check available models:**
   ```bash
   ollama list
   ```

3. **Pull the required model:**
   ```bash
   # For llama3.2
   ollama pull llama3.2:latest
   
   # Or try alternatives
   ollama pull llama2
   ollama pull mistral
   ```

4. **Update the model in .env.ollama:**
   ```bash
   OLLAMA_MODEL=llama2  # or whatever model you have available
   ```

### 2. Invalid Nonce Error

**Problem:** `❌ Contract execution failed: Error: execution reverted: "Invalid nonce"`

**Solutions:**

1. **Check contract address mismatch:**
   - Ensure client and relayer use the same contract address
   - Update `CONTRACT_ADDRESS` in `.env.ollama`

2. **Fetch fresh nonce:**
   ```bash
   curl http://localhost:3000/nonce/0x70997970c51812dc3a010c7d01b50e0d17dc79c8
   ```

3. **Reset blockchain state:**
   - If using local blockchain, restart it
   - Clear any cached transaction data

### 3. Connection Issues

**Problem:** Cannot connect to relayer or Ollama

**Solutions:**

1. **Check relayer is running:**
   ```bash
   cd relayer
   npm start
   ```

2. **Check ports:**
   - Relayer: `http://localhost:3000`
   - Ollama: `http://localhost:11434`
   - Blockchain: `http://localhost:9650/...`

3. **Test endpoints:**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Ollama status
   curl http://localhost:3000/ollama-status
   ```

## Troubleshooting Tool

Run the automated troubleshooting script:

```bash
node troubleshoot.js
```

This will check:
- ✅ Ollama connectivity and available models
- ✅ Nonce endpoint functionality  
- ✅ Validation endpoint (with fallback)

## Quick Setup Commands

1. **Start Ollama:**
   ```bash
   ollama serve
   ```

2. **Pull a model (choose one):**
   ```bash
   ollama pull llama3.2:latest  # Recommended
   ollama pull llama2           # Alternative
   ollama pull mistral          # Alternative
   ```

3. **Configure environment:**
   ```bash
   cp .env.ollama .env
   # Edit .env with your blockchain and model settings
   ```

4. **Start relayer:**
   ```bash
   npm install
   npm start
   ```

5. **Test the client:**
   ```bash
   cd ../client
   npm install
   node signer.js
   ```

## Environment Variables

Key variables in `.env.ollama`:

- `OLLAMA_MODEL`: The AI model to use (e.g., `llama3.2:latest`)
- `CONTRACT_ADDRESS`: Smart contract address
- `RPC_URL`: Blockchain RPC endpoint
- `PORT`: Relayer server port (default: 3000)
- `SIGNIFICANCE_THRESHOLD`: Minimum significance score (0.0-1.0)

## Success Indicators

When everything works correctly, you should see:

```
🚀 EIP-712 Ollama AI Relayer Service
===================================
🔗 Contract: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
🌐 Network: http://localhost:9650/...
🤖 AI Model: llama3.2:latest
📊 Significance Threshold: 0.1
🔗 Port: 3000

🌐 EIP-712 Ollama AI Relayer running on port 3000
```

And successful transaction:
```
🤖 Validating interaction with llama3.2:latest: "share_post-23456"
🤖 AI Response: DECISION: approve...
🎯 Validation result: { approved: true, significance: 0.8, ... }
📤 Sending transaction to contract...
✅ Transaction confirmed: 0x123...
```
