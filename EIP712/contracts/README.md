# EIP-712 Meta-Transaction Contract

This contract implements EIP-712 typed data signing for meta-transactions with AI validation.

## Contract Overview

The `MetaTxInteraction` contract allows users to sign transactions off-chain that can be executed by a relayer, enabling gasless transactions with AI-powered validation.

## Nonce Mechanism

### What is a Nonce?

A **nonce** (Number used ONCE) is a critical security mechanism that prevents replay attacks in meta-transactions. Each user has their own nonce counter that ensures transaction uniqueness and ordering.

### Key Security Features:

#### 1. **Prevents Replay Attacks**

```solidity
require(nonce == nonces[user], "Invalid nonce");
```

- Each user has an individual nonce counter starting at 0
- The nonce must match exactly what the contract expects
- Prevents malicious actors from reusing old signed transactions

#### 2. **Ensures Transaction Ordering**

```solidity
nonces[user]++;
```

- After each successful transaction, the user's nonce increments by 1
- Transactions must be executed in sequential order: 0, 1, 2, 3...
- Cannot skip nonces or execute them out of order

#### 3. **Part of the Cryptographic Signature**

```solidity
keccak256(abi.encode(META_TX_TYPEHASH, user, keccak256(bytes(interaction)), nonce))
```

- The nonce is included in the data that gets signed
- Makes each signature unique, even for identical interactions
- Without the correct nonce, signature verification fails

### Example Flow:

**User Alice's Transaction History:**

1. **First Transaction**: `{user: Alice, interaction: "share_post-123", nonce: 0}`
   - Contract checks: nonce 0 matches Alice's current nonce ✅
   - Executes transaction and increments Alice's nonce to 1

2. **Second Transaction**: `{user: Alice, interaction: "like_post-456", nonce: 1}`
   - Contract checks: nonce 1 matches Alice's current nonce ✅
   - Executes transaction and increments Alice's nonce to 2

### Attack Prevention:

❌ **Replay Attack Prevention**:

- Attacker intercepts Alice's first transaction and tries to replay it
- Contract check: signature nonce = 0, but Alice's current nonce = 2
- Result: Transaction fails with "Invalid nonce"

❌ **Out-of-Order Prevention**:

- Someone tries to submit Alice's future transaction with nonce 5
- Contract check: signature nonce = 5, but Alice's current nonce = 2
- Result: Transaction fails with "Invalid nonce"

### Implementation Details:

```solidity
// Per-user nonce storage
mapping(address => uint256) public nonces;

// Nonce verification in executeMetaTx
require(nonce == nonces[user], "Invalid nonce");

// Nonce increment after successful execution
nonces[user]++;
```

### Integration with Relayer:

The relayer system fetches the current nonce before creating transactions:

```javascript
// Fetch current nonce from contract
const currentNonce = await contract.nonces(userAddress);

// Include in signature creation
const signature = await user._signTypedData(domain, types, {
    user: userAddress,
    interaction: "share_post-123", 
    nonce: currentNonce
});
```

This ensures that:

- Each transaction uses the correct, current nonce
- Transactions are processed in the proper sequence
- Old signatures cannot be maliciously replayed
- The system maintains security and integrity

The nonce acts as a **transaction counter** that makes each meta-transaction unique and prevents common security vulnerabilities in gasless transaction systems! 🔐

---

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
