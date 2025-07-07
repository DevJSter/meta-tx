#!/bin/bash

# Meta-Transaction System Setup Script
# Choose between EIP-712 and EIP-2771 implementations

set -e  # Exit on any error

echo "🚀 Meta-Transaction System Setup"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_header() {
    echo -e "${CYAN}$1${NC}"
}

echo ""
print_header "Welcome to the Meta-Transaction System Setup!"
echo ""
print_info "This project demonstrates two different approaches to meta-transactions:"
echo ""
echo "1. 🔐 EIP-712: Direct signature validation meta-transactions"
echo "   • Simpler implementation"
echo "   • Direct signature verification in contract"
echo "   • Minimal relay service for AI validation"
echo ""
echo "2. 🔄 EIP-2771: Forwarder-based meta-transactions with AI validation"
echo "   • Standard EIP-2771 compliant implementation"
echo "   • Advanced AI validation using Ollama"
echo "   • Forwarder pattern for better composability"
echo "   • Significance scoring and validation controls"
echo ""

# Check if we're in the right directory
if [[ ! -d "EIP712" ]] || [[ ! -d "EIP2771" ]]; then
    print_error "Please run this script from the project root directory (new-ai-validator)"
    exit 1
fi

# Menu selection
while true; do
    echo "Please choose which implementation to set up:"
    echo ""
    echo "1) EIP-712 Implementation (contracts/)"
    echo "2) EIP-2771 Implementation with AI Validation (EIP2771/)"
    echo "3) Both implementations"
    echo "4) Show comparison between implementations"
    echo "5) Exit"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            print_header "Setting up EIP-712 Implementation..."
            echo ""
            cd EIP712/
            ./setup.sh
            break
            ;;
        2)
            print_header "Setting up EIP-2771 Implementation with AI Validation..."
            echo ""
            cd EIP2771/
            ./setup.sh
            break
            ;;
        3)
            print_header "Setting up both implementations..."
            echo ""
            print_info "First setting up EIP-712..."
            cd EIP712/
            ./setup.sh
            cd ..
            echo ""
            print_info "Now setting up EIP-2771..."
            cd EIP2771/
            ./setup.sh
            break
            ;;
        4)
            print_header "📊 Implementation Comparison"
            echo ""
            if [[ -f "DIFFERENCE.md" ]]; then
                echo "Reading from DIFFERENCE.md..."
                echo ""
                head -50 DIFFERENCE.md
                echo ""
                echo "📖 For complete comparison, read: DIFFERENCE.md"
            else
                echo "EIP-712 vs EIP-2771 Key Differences:"
                echo ""
                echo "EIP-712 (Direct Signatures):"
                echo "• ✅ Simpler contract logic"
                echo "• ✅ Direct signature verification"
                echo "• ✅ Less gas overhead"
                echo "• ❌ Less composable"
                echo "• ❌ Basic AI validation"
                echo ""
                echo "EIP-2771 (Forwarder Pattern):"
                echo "• ✅ Standard compliant"
                echo "• ✅ Highly composable"
                echo "• ✅ Advanced AI validation"
                echo "• ✅ Better separation of concerns"
                echo "• ❌ More complex setup"
                echo "• ❌ Higher gas costs"
            fi
            echo ""
            ;;
        5)
            print_info "Goodbye! 👋"
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please enter 1-5."
            echo ""
            ;;
    esac
done

echo ""
print_status "Setup process completed!"
echo ""
print_info "📚 Documentation:"
echo "   • Project overview: README.md"
echo "   • EIP-712 docs: EIP712/README.md"
echo "   • EIP-2771 docs: EIP2771/README.md"
echo "   • Comparison: DIFFERENCE.md"
echo ""
print_info "🔗 Useful links:"
echo "   • EIP-712 Standard: https://eips.ethereum.org/EIPS/eip-712"
echo "   • EIP-2771 Standard: https://eips.ethereum.org/EIPS/eip-2771"
echo "   • Ollama: https://ollama.ai"
echo ""
print_status "Happy meta-transacting! 🚀"
