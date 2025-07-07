#!/bin/bash

# Test script to verify setup scripts work correctly
# This performs basic checks without actually running the setup

echo "🧪 Testing Setup Scripts"
echo "========================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

print_test() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

cd /Users/qoneqt/Desktop/shubham/ava-chain/new-ai-validator

echo "1. Testing main setup script..."
if [[ -f "setup.sh" && -x "setup.sh" ]]; then
    print_test "Main setup script exists and is executable"
    
    # Test syntax
    if bash -n setup.sh; then
        print_test "Main setup script syntax is valid"
    else
        print_error "Main setup script has syntax errors"
    fi
else
    print_error "Main setup script missing or not executable"
fi

echo ""
echo "2. Testing EIP-712 setup script..."
if [[ -f "EIP712/setup.sh" && -x "EIP712/setup.sh" ]]; then
    print_test "EIP-712 setup script exists and is executable"
    
    # Test syntax
    if bash -n EIP712/setup.sh; then
        print_test "EIP-712 setup script syntax is valid"
    else
        print_error "EIP-712 setup script has syntax errors"
    fi
else
    print_error "EIP-712 setup script missing or not executable"
fi

echo ""
echo "3. Testing EIP-2771 setup script..."
if [[ -f "EIP2771/setup.sh" && -x "EIP2771/setup.sh" ]]; then
    print_test "EIP-2771 setup script exists and is executable"
    
    # Test syntax
    if bash -n EIP2771/setup.sh; then
        print_test "EIP-2771 setup script syntax is valid"
    else
        print_error "EIP-2771 setup script has syntax errors"
    fi
else
    print_error "EIP-2771 setup script missing or not executable"
fi

echo ""
echo "4. Testing directory structure..."
if [[ -d "EIP712" && -d "EIP2771" && -d "client" && -d "relayer" ]]; then
    print_test "All required directories exist"
else
    print_error "Missing required directories"
fi

echo ""
echo "5. Testing key files..."
files_to_check=(
    "README.md"
    "DIFFERENCE.md"
    "EIP712/README.md"
    "EIP2771/README.md"
    "client/README.md"
    "relayer/README.md"
)

for file in "${files_to_check[@]}"; do
    if [[ -f "$file" ]]; then
        print_test "$file exists"
    else
        print_error "$file missing"
    fi
done

echo ""
echo "🎯 Setup Script Testing Complete!"
echo ""
echo "To run the actual setup:"
echo "  ./setup.sh"
echo ""
echo "Or run individual setups:"
echo "  cd EIP712/ && ./setup.sh       # EIP-712"
echo "  cd EIP2771/ && ./setup.sh      # EIP-2771"
