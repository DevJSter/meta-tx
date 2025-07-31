# 🔍 Meta-Transaction Verification Guide

## Understanding Meta-Transactions vs Block Explorer Data

### What You See in Block Explorer:
```
From: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Relayer)
To: 0x59b670e9fA9D0A427751Af201D676719a970857b (Contract)
Gas: Paid by Relayer
```

### What Actually Happened:
```
Real User: 0x8FD335472F5529e63B2e58EAA3d5Fb1C57f5c753
- Signed the transaction data
- Pays NO gas fees
- Receives reputation tokens

Relayer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- Submits transaction to blockchain
- Pays ALL gas fees
- Appears as "from" in explorer
```

## 🔍 How to Verify Original Signer

### Method 1: Use Our Verification Script
```bash
# Show last 10 meta-transactions with original signers
node verify-signer.js

# Verify specific transaction
node verify-signer.js 0xac19463af6f9d43f73cb807709ab8112a9b9ef888973a38373f855509cec5086

# Show help
node verify-signer.js --help
```

### Method 2: Check Transaction Events
1. Go to blockchain explorer
2. Find the transaction
3. Look at **Events/Logs** tab
4. Find `InteractionPerformed` event
5. The `user` field shows the **real signer**

### Method 3: Manual RPC Query
```bash
# Get transaction receipt
curl -X POST https://subnets.avax.network/thane/testnet/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getTransactionReceipt",
    "params": ["YOUR_TX_HASH"],
    "id": 1
  }'
```

Look for logs with address `0x59b670e9fA9D0A427751Af201D676719a970857b` and decode the events.

## 📊 Sample Output Format

When you run `node verify-signer.js`, you'll see:

```
🔸 Meta-Transaction #1
──────────────────────────────────────────────────
📄 Transaction Details:
   From (Gas Payer): 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   To (Contract): 0x59b670e9fA9D0A427751Af201D676719a970857b
   Block: 58
   Gas Used: 366922

✅ Event Found: InteractionPerformed
   Real User (Original Signer): 0x8FD335472F5529e63B2e58EAA3d5Fb1C57f5c753
   Interaction: "follow_user-expert_smart_contract_auditor"
   Significance: 75
   Nonce: 0
   Transaction Hash: 0xe2b71f94f781f0211f5100bc4ec1a0fe4b502b81331e567a85092dfe6708c09d

🎯 VERIFICATION RESULT:
   ✅ Original Signer: 0x8FD335472F5529e63B2e58EAA3d5Fb1C57f5c753
   ✅ Gas Paid By: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   ✅ Different Addresses: true

✅ This is a valid meta-transaction!
   - User signed without paying gas
   - Relayer paid gas and submitted
   - User gets the reputation rewards
```

## 🎯 Key Points

1. **Block Explorer Shows Relayer**: The "from" field always shows the relayer address
2. **Events Show Real User**: Contract events contain the original signer's address
3. **Gas Payment**: Relayer pays gas, user pays nothing
4. **Token Rewards**: Go to the real user, not the relayer
5. **Different Signers**: Each meta-transaction can have different original signers

## 🚀 Generate Test Transactions

To test with different users:
```bash
node generate-test-tx.js
```

This will create a transaction from a different user account, then you can run:
```bash
node verify-signer.js
```

To see how the script displays different signers in the transaction history.

## 📋 Contract Events Reference

The `InteractionPerformed` event contains:
- `user` (indexed): The original signer's address
- `interaction`: The interaction string
- `significance`: AI-calculated significance score
- `nonce` (indexed): User's transaction nonce
- `txHash` (indexed): Reference hash for the interaction

This is how we prove that the real user signed the transaction, even though the relayer submitted it!
