#!/bin/bash

# EIP-2771 Meta-Transaction System with AI Validation Setup Script
# This script automates the setup of the EIP-2771 implementation

set -e  # Exit on any error

echo "🚀 EIP-2771 Meta-Transaction System with AI Validation Setup"
echo "=========================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running from correct directory
if [[ ! -f "foundry.toml" ]] || [[ ! -d "src" ]]; then
    print_error "Please run this script from the EIP2771 directory"
    exit 1
fi

# Default configuration
RPC_URL=${RPC_URL:-"http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc"}
CHAIN_ID=${CHAIN_ID:-"930393"}
PRIVATE_KEY=${PRIVATE_KEY:-"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"}
OLLAMA_MODEL=${OLLAMA_MODEL:-"llama3.2:latest"}
AI_SERVICE_PORT=${AI_SERVICE_PORT:-"3001"}

echo ""
print_info "Configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Chain ID: $CHAIN_ID"
echo "  Ollama Model: $OLLAMA_MODEL"
echo "  AI Service Port: $AI_SERVICE_PORT"
echo ""

# Step 1: Check prerequisites
echo "📋 Step 1: Checking Prerequisites"
echo "================================="

# Check if foundry is installed
if ! command -v forge &> /dev/null; then
    print_warning "Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
    print_status "Foundry installed"
else
    print_status "Foundry found"
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js v18+ manually"
    exit 1
else
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
else
    print_status "npm found"
fi

# Check if ollama is installed
if ! command -v ollama &> /dev/null; then
    print_warning "Ollama not found. Please install Ollama manually:"
    echo "  macOS: brew install ollama"
    echo "  Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    echo "  Or download from: https://ollama.ai"
    echo ""
    read -p "Press Enter after installing Ollama..."
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    print_warning "Ollama not running. Starting Ollama..."
    ollama serve &
    OLLAMA_PID=$!
    sleep 5
    print_status "Ollama started (PID: $OLLAMA_PID)"
else
    print_status "Ollama is running"
fi

# Pull Ollama model
print_info "Pulling Ollama model: $OLLAMA_MODEL"
if ollama list | grep -q "$OLLAMA_MODEL"; then
    print_status "Model $OLLAMA_MODEL already available"
else
    ollama pull "$OLLAMA_MODEL"
    print_status "Model $OLLAMA_MODEL pulled"
fi

echo ""

# Step 2: Setup smart contracts
echo "📦 Step 2: Setting up Smart Contracts"
echo "====================================="

# Install npm dependencies for the AI service
if [[ ! -d "node_modules" ]]; then
    print_info "Installing Node.js dependencies..."
    npm install
    print_status "Node.js dependencies installed"
fi

# Install Foundry dependencies
print_info "Installing Foundry dependencies..."
forge install 
print_status "Foundry dependencies installed"

# Build contracts
print_info "Building contracts..."
forge build
print_status "Contracts built successfully"

# Run tests
print_info "Running contract tests..."
if forge test -v; then
    print_status "All tests passed"
else
    print_warning "Some tests failed, but continuing..."
fi

# Deploy contracts
print_info "Deploying contracts..."
echo "Using RPC: $RPC_URL"

# Check if blockchain is accessible
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
   "$RPC_URL" > /dev/null; then
    print_status "Blockchain accessible"
    
    # Deploy contracts
    DEPLOY_OUTPUT=$(forge script script/DeployLocal.s.sol \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --broadcast 2>&1)
    
    if echo "$DEPLOY_OUTPUT" | grep -q "ONCHAIN EXECUTION COMPLETE"; then
        print_status "Contracts deployed successfully"
        
        # Extract contract addresses from output
        FORWARDER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "AIValidatedForwarder deployed at:" | sed 's/.*: //')
        RECIPIENT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "MetaTxInteractionRecipient deployed at:" | sed 's/.*: //')
        
        print_info "AIValidatedForwarder deployed at: $FORWARDER_ADDRESS"
        print_info "MetaTxInteractionRecipient deployed at: $RECIPIENT_ADDRESS"
        
        # Save addresses for configuration
        echo "$FORWARDER_ADDRESS" > .forwarder_address
        echo "$RECIPIENT_ADDRESS" > .recipient_address
    else
        print_error "Contract deployment failed"
        echo "$DEPLOY_OUTPUT"
        exit 1
    fi
else
    print_warning "Blockchain not accessible. Skipping deployment."
    print_info "You can deploy later with:"
    echo "  forge script script/DeployLocal.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast"
fi

echo ""

# Step 3: Setup client
echo "🖥️  Step 3: Setting up Client"
echo "============================="

cd client/

# Install npm dependencies
print_info "Installing client dependencies..."
npm install
print_status "Client dependencies installed"

# Update configuration if contracts were deployed
if [[ -f "../.forwarder_address" ]] && [[ -f "../.recipient_address" ]]; then
    FORWARDER_ADDRESS=$(cat ../.forwarder_address)
    RECIPIENT_ADDRESS=$(cat ../.recipient_address)
    
    print_info "Updating client configuration with contract addresses..."
    
    # Update signer.js with deployed contract addresses
    sed -i.bak "s/const FORWARDER_ADDRESS = '.*';/const FORWARDER_ADDRESS = '$FORWARDER_ADDRESS';/" signer.js 2>/dev/null || \
    sed -i.bak "s/const forwarderAddress = '.*';/const forwarderAddress = '$FORWARDER_ADDRESS';/" signer.js 2>/dev/null || \
    sed -i.bak "s/forwarderAddress: '.*'/forwarderAddress: '$FORWARDER_ADDRESS'/" signer.js
    
    sed -i.bak "s/const RECIPIENT_ADDRESS = '.*';/const RECIPIENT_ADDRESS = '$RECIPIENT_ADDRESS';/" signer.js 2>/dev/null || \
    sed -i.bak "s/const recipientAddress = '.*';/const recipientAddress = '$RECIPIENT_ADDRESS';/" signer.js 2>/dev/null || \
    sed -i.bak "s/recipientAddress: '.*'/recipientAddress: '$RECIPIENT_ADDRESS'/" signer.js
    
    print_status "Client configuration updated"
fi

cd ..

echo ""

# Step 4: Setup AI service configuration
echo "🤖 Step 4: Setting up AI Service"
echo "================================="

# Create environment configuration for AI service
print_info "Creating AI service configuration..."
cat > .env << EOF
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=$OLLAMA_MODEL
RPC_URL=$RPC_URL
PRIVATE_KEY=$PRIVATE_KEY
CHAIN_ID=$CHAIN_ID
AI_SERVICE_PORT=$AI_SERVICE_PORT
EOF

# Update configuration if contracts were deployed
if [[ -f ".forwarder_address" ]] && [[ -f ".recipient_address" ]]; then
    FORWARDER_ADDRESS=$(cat .forwarder_address)
    RECIPIENT_ADDRESS=$(cat .recipient_address)
    echo "FORWARDER_ADDRESS=$FORWARDER_ADDRESS" >> .env
    echo "RECIPIENT_ADDRESS=$RECIPIENT_ADDRESS" >> .env
    
    # Update AI service with contract addresses
    sed -i.bak "s/const FORWARDER_ADDRESS = '.*';/const FORWARDER_ADDRESS = '$FORWARDER_ADDRESS';/" ollama-ai-service.js 2>/dev/null || \
    sed -i.bak "s/forwarderAddress: '.*'/forwarderAddress: '$FORWARDER_ADDRESS'/" ollama-ai-service.js
    
    print_status "AI service configuration updated"
fi

print_status "Environment file created"

echo ""

# Step 5: Final setup and instructions
echo "🎯 Step 5: Setup Complete!"
echo "=========================="

print_status "EIP-2771 Meta-Transaction System with AI Validation setup completed!"
echo ""

print_info "Architecture Overview:"
echo "  1. Client (client/signer.js) → Creates meta-transactions"
echo "  2. AI Service (ollama-ai-service.js) → Validates content using Ollama"
echo "  3. Forwarder Contract → Forwards validated transactions"
echo "  4. Recipient Contract → Executes the final transaction"
echo ""

print_info "Next steps to run the system:"
echo ""
echo "1. Start the AI service (Terminal 1):"
echo "   node ollama-ai-service.js"
echo ""
echo "2. Run the client (Terminal 2):"
echo "   cd client/"
echo "   node signer.js"
echo ""

print_info "Health checks:"
echo "   Ollama API:    curl http://localhost:11434/api/tags"
echo "   AI Service:    curl http://localhost:$AI_SERVICE_PORT/health"
echo "   Blockchain:    curl -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"net_version\",\"params\":[],\"id\":1}' $RPC_URL"
echo ""

if [[ -f ".forwarder_address" ]] && [[ -f ".recipient_address" ]]; then
    FORWARDER_ADDRESS=$(cat .forwarder_address)
    RECIPIENT_ADDRESS=$(cat .recipient_address)
    print_info "Deployed contract addresses:"
    echo "   Forwarder: $FORWARDER_ADDRESS"
    echo "   Recipient: $RECIPIENT_ADDRESS"
    echo ""
fi

print_info "Key Features:"
echo "   • AI-powered content validation using Ollama"
echo "   • EIP-2771 compliant meta-transaction forwarding"
echo "   • Significance scoring and thresholds"
echo "   • Owner and validator controls"
echo "   • Gas-less transactions for users"
echo ""

print_status "Setup complete! Happy AI-validated meta-transacting! 🚀🤖"

# Cleanup function
cleanup() {
    if [[ -n "$OLLAMA_PID" ]]; then
        print_info "Stopping Ollama service..."
        kill $OLLAMA_PID 2>/dev/null || true
    fi
}

# Register cleanup function
trap cleanup EXIT
