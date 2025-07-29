# Using EIP-4844 with Your Custom Configuration

## Overview
This project has been configured with your custom RPC endpoint and wallet credentials to send blob transactions to the specified destination address.

## Configuration
The `.env` file has been set up with:
- **RPC URL**: Your Avalanche testnet RPC endpoint  
- **Private Key**: Your wallet private key (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
- **Destination Address**: 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f

## Available Methods

### 1. Generate Raw Transaction (eth_sendRawTransaction)

This method creates a blob transaction and generates a curl command for `eth_sendRawTransaction`.

```bash
cd blob-eth_sendRawTransaction-curl-generator
go run main.go
```

This will:
- Create a blob transaction from your wallet to the destination address
- Generate a curl command in `blob_eth_sendRawTransaction.sh` 
- Print the raw transaction data

### 2. Go SDK Method (Direct Transaction Sending)

This method sends the blob transaction directly using the Go Ethereum client.

```bash
cd blob-send-transaction-Go-SDK
go run main.go
```

This will:
- Create and send a blob transaction directly to the network
- Monitor the transaction status
- Attempt fee escalation if the transaction gets stuck

## Important Notes

⚠️ **Network Compatibility**: EIP-4844 (blob transactions) requires the network to support the Cancun upgrade. Make sure your Avalanche testnet supports EIP-4844.

⚠️ **Funding**: Ensure your wallet (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266) has sufficient funds for:
- Regular gas fees
- Blob gas fees (calculated separately)

⚠️ **Blob Data**: The transactions include random blob data. Each blob is ~128KB and costs blob gas.

## Troubleshooting

1. **"Network not supported"**: The RPC endpoint may not support EIP-4844
2. **"Insufficient funds"**: Add more test tokens to your wallet
3. **"Transaction underpriced"**: The blob gas market may be competitive

## What Happens

When you run either method:
1. A random blob (~128KB) is generated
2. KZG commitments and proofs are created
3. A blob transaction is constructed sending from your wallet to 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
4. The transaction is signed and submitted/prepared

The blob data will be available on the network for ~30 days and can be queried using the blob hash from the transaction receipt.
