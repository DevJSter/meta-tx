#!/bin/bash

echo "=========================================="
echo "EIP-4844 Blob Transaction Test Runner"
echo "=========================================="
echo ""
echo "Configuration:"
echo "- From: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "- To: 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
echo "- RPC: Avalanche Testnet"
echo ""

echo "Please choose an option:"
echo "1. Generate raw transaction (curl command)"
echo "2. Send transaction directly via Go SDK"
echo "3. Generate curl for eth_sendTransaction"
echo "4. Exit"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Generating raw transaction..."
        cd blob-eth_sendRawTransaction-curl-generator
        go run main.go
        echo ""
        echo "Generated script: ./blob-eth_sendRawTransaction-curl-generator/blob_eth_sendRawTransaction.sh"
        echo "You can run it with: ./blob-eth_sendRawTransaction-curl-generator/blob_eth_sendRawTransaction.sh"
        ;;
    2)
        echo ""
        echo "Sending transaction directly..."
        cd blob-send-transaction-Go-SDK
        go run main.go
        ;;
    3)
        echo ""
        echo "Generating eth_sendTransaction curl..."
        cd blob-eth_sendTransaction-curl-generator
        go run main.go
        echo ""
        echo "Generated script: ./blob-eth_sendTransaction-curl-generator/blob_eth_sendTransaction.sh"
        echo "You can run it with: ./blob-eth_sendTransaction-curl-generator/blob_eth_sendTransaction.sh"
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option. Please run the script again."
        exit 1
        ;;
esac
