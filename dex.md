# Oboswap Core Contracts Architecture

This document explains how all Oboswap contracts are connected and how the decentralized exchange (DEX) works.

## 🏗️ Architecture Overview

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                 OBOSWAP ECOSYSTEM                      │
                    └─────────────────────────────────────────────────────────┘
                                              │
        ┌─────────────────────┬─────────────────┴─────────────────┬─────────────────────┐
        │                     │                                   │                     │
   ┌────▼────┐         ┌─────▼─────┐                        ┌────▼────┐         ┌─────▼─────┐
   │ 👤 USER │         │ 🪙 TokenA │                        │ 🪙 TokenB│         │🔄 Router  │
   │ Trader  │         │  (ERC20)  │                        │  (ERC20) │         │(Future)   │
   └────┬────┘         └─────┬─────┘                        └────┬────┘         └─────┬─────┘
        │                    │                                   │                    │
        │              ┌─────▼───────────────────────────────────▼─────┐              │
        │              │          🏭 OBOSWAP FACTORY                   │              │
        │              │     ┌─────────────────────────────────┐       │              │
        │              │     │ • Creates Trading Pairs        │       │              │
        │              │     │ • Manages Fee Settings         │◄──────┼──────────────┘
        │              │     │ • Registry of All Pairs        │       │
        │              │     │ • Protocol Governance          │       │
        │              │     └─────────────────────────────────┘       │
        │              └─────┬───────────────────────────────────┬─────┘
        │                    │                                   │
        │              ┌─────▼─────┐                     ┌─────▼─────┐
        │              │💱 PAIR #1 │                     │💱 PAIR #2 │
        │              │TokenA/TokenB                    │TokenX/TokenY
        │              │           │                     │           │
        └──────────────┼─── AMM ───┤                     │   AMM     │
                       │  Engine   │                     │  Engine   │
                       │           │                     │           │
                       └─────┬─────┘                     └───────────┘
                             │
                   ┌─────────▼─────────┐
                   │  📜 OBOSWAP ERC20  │
                   │   (LP Tokens)      │
                   │ ┌─────────────────┐│
                   │ │ • Liquidity     ││
                   │ │   Ownership     ││
                   │ │ • Fee Sharing   ││
                   │ │ • Transferable  ││
                   │ └─────────────────┘│
                   └───────────────────┘

              ┌─────────────────────────────────────────────────────┐
              │               CORE LIBRARIES                        │
              │                                                     │
              │  🧮 Math        🔢 SafeMath       📐 UQ112x112      │
              │  Library        Library           Fixed Point       │
              │                                                     │
              └─────────────────────────────────────────────────────┘
```

## 🔗 Contract Relationships

### 1. **OboswapFactory** - The Central Hub 🏭

```
                           ┌─────────────────────────────────────────┐
                           │           OBOSWAP FACTORY               │
                           │                                         │
    ┌─────────────────────►│  📋 FUNCTIONS:                         │
    │                      │  ├─ createPair(tokenA, tokenB)         │
    │ User Request          │  ├─ getPair(tokenA, tokenB)           │
    │                      │  ├─ allPairsLength()                   │
    │                      │  ├─ setFeeTo(address)                  │
    │                      │  └─ setFeeToSetter(address)            │
    │                      │                                         │
    │                      │  💾 STORAGE:                           │
    │                      │  ├─ mapping(token→token→pair)          │
    │                      │  ├─ address[] allPairs                 │
    │                      │  ├─ address feeTo                      │
    │                      │  └─ address feeToSetter                │
    │                      └─────────────────┬───────────────────────┘
    │                                        │
    │                           ┌────────────▼────────────┐
    │                           │     CREATES & MANAGES   │
    │                           └────────────┬────────────┘
    │                                        │
    │      ┌─────────────────┬───────────────▼───────────────┬─────────────────┐
    │      │                 │                               │                 │
    │  ┌───▼───┐         ┌───▼───┐                       ┌───▼───┐         ┌───▼───┐
    │  │ PAIR1 │         │ PAIR2 │                       │ PAIR3 │         │ PAIR4 │
    │  │A/B    │         │X/Y    │          ...          │A/X    │         │B/Y    │
    │  └───────┘         └───────┘                       └───────┘         └───────┘
    │
    └─ Emits: PairCreated(token0, token1, pair, pairCount)
```

**Key Responsibilities:**
- **Creates new trading pairs** between any two ERC20 tokens
- **Maintains registry** of all existing pairs
- **Manages protocol fees** (feeTo address)
- **Controls governance** (feeToSetter permissions)

### 2. **OboswapPair** - The Trading Engine 💱

```
                    ┌───────────────────────────────────────────────────────────┐
                    │                   OBOSWAP PAIR                           │
                    │                  (AMM CONTRACT)                          │
                    └─────────────────────┬─────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────────┐
        │                                 │                                     │
   ┌────▼────┐                      ┌────▼────┐                         ┌─────▼─────┐
   │LIQUIDITY│                      │ TRADING │                         │   STATE   │
   │FUNCTIONS│                      │FUNCTIONS│                         │ FUNCTIONS │
   └─────────┘                      └─────────┘                         └───────────┘
        │                                 │                                     │
   ┌────▼────┐                      ┌────▼────┐                         ┌─────▼─────┐
   │ mint()  │◄──── Add Liquidity   │ swap()  │◄──── Execute Trade      │getReserves│
   │         │                      │         │                         │    ()     │
   │ Mints   │                      │Updates  │                         │           │
   │LP Tokens│                      │Reserves │                         │Current    │
   └─────────┘                      └─────────┘                         │Balances   │
        │                                 │                             └───────────┘
   ┌────▼────┐                      ┌────▼────┐                         ┌─────▼─────┐
   │ burn()  │◄──── Remove Liquidity│getInput │◄──── Calculate Output   │price0Cum- │
   │         │                      │Price()  │                         │ulative() │
   │ Burns   │                      │         │                         │           │
   │LP Tokens│                      │AMM Math │                         │Oracle Data│
   └─────────┘                      └─────────┘                         └───────────┘

                            ┌─────────────────────────────────┐
                            │          STORAGE STATE          │
                            │                                 │
                            │  💰 reserve0  (Token A Balance) │
                            │  💰 reserve1  (Token B Balance) │
                            │  ⏰ blockTimestampLast          │
                            │  📊 price0CumulativeLast        │
                            │  📊 price1CumulativeLast        │
                            │  🔐 kLast (invariant)           │
                            │  🔒 unlocked (reentrancy)       │
                            └─────────────────────────────────┘

                            ┌─────────────────────────────────┐
                            │         INHERITED FROM          │
                            │       OBOSWAP ERC20            │
                            │                                 │
                            │  📜 LP Token Functions:         │
                            │  ├─ transfer()                  │
                            │  ├─ approve()                   │
                            │  ├─ transferFrom()              │
                            │  ├─ permit() (meta-txns)        │
                            │  └─ balanceOf()                 │
                            └─────────────────────────────────┘
```

**Key Features:**
- **Automated Market Maker (AMM)** using constant product formula: `x * y = k`
- **Liquidity Provider (LP) tokens** representing ownership share
- **Price oracles** with time-weighted average prices (TWAP)
- **Flash loan capabilities** via swap with callback

### 3. **OboswapERC20** - LP Token Standard 📜

```
                         ┌─────────────────────────────────────────┐
                         │            OBOSWAP ERC20                │
                         │         (LP TOKEN CONTRACT)             │
                         └─────────────────┬───────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
             ┌──────▼──────┐        ┌─────▼─────┐        ┌──────▼──────┐
             │   STANDARD  │        │  EXTENDED │        │   PERMIT    │
             │ ERC20 FUNCS │        │ FUNCTIONS │        │ FUNCTIONS   │
             └─────────────┘        └───────────┘        └─────────────┘
                    │                      │                      │
             ┌──────▼──────┐        ┌─────▼─────┐        ┌──────▼──────┐
             │ transfer()  │        │   name    │        │ permit()    │
             │ approve()   │        │  symbol   │        │            │
             │transferFrom│        │ decimals  │        │ Meta-txns   │
             │ balanceOf() │        │totalSupply│        │ (Gasless)   │
             │ allowance() │        │           │        │             │
             └─────────────┘        └───────────┘        └─────────────┘

                         ┌─────────────────────────────────────────┐
                         │              REPRESENTS                 │
                         │                                         │
                         │  🏦 Share of Liquidity Pool            │
                         │  💰 Claim on Trading Fees              │
                         │  🔄 Proportional Token Ownership       │
                         │  �� Transferable & Tradeable           │
                         │                                         │
                         │  Formula: LP = √(amount0 × amount1)    │
                         └─────────────────────────────────────────┘
```

## 🔄 Trading Flow Diagram

```
    👤 USER                🏭 FACTORY              💱 PAIR                🪙 TOKENS
       │                      │                      │                      │
       │                      │                      │                      │
   ┌───┴────────────────────────────────────────────────────────────────────┴───┐
   │                    1. CREATING A TRADING PAIR                              │
   └───┬────────────────────────────────────────────────────────────────────┬───┘
       │                      │                      │                      │
       │ createPair(A,B)      │                      │                      │
       ├─────────────────────►│                      │                      │
       │                      │ deploy new contract  │                      │
       │                      ├─────────────────────►│                      │
       │                      │ initialize(A,B)      │                      │
       │                      ├─────────────────────►│                      │
       │                      │ pair address         │                      │
       │                      │◄─────────────────────┤                      │
       │ pair created ✅      │                      │                      │
       │◄─────────────────────┤                      │                      │
       │                      │                      │                      │
   ┌───┴────────────────────────────────────────────────────────────────────┴───┐
   │                    2. ADDING LIQUIDITY                                     │
   └───┬────────────────────────────────────────────────────────────────────┬───┘
       │                      │                      │                      │
       │                      │                      │ approve(pair, amtA)  │
       │                      │                      │◄─────────────────────┤
       │                      │                      │ approve(pair, amtB)  │
       │                      │                      │◄─────────────────────┤
       │ mint(to)             │                      │                      │
       ├─────────────────────────────────────────────►│                      │
       │                      │                      │ transferFrom(A,amtA) │
       │                      │                      ├─────────────────────►│
       │                      │                      │ transferFrom(B,amtB) │
       │                      │                      ├─────────────────────►│
       │ mint LP tokens       │                      │                      │
       │◄─────────────────────────────────────────────┤                      │
       │                      │                      │                      │
   ┌───┴────────────────────────────────────────────────────────────────────┴───┐
   │                    3. EXECUTING A SWAP                                     │
   └───┬────────────────────────────────────────────────────────────────────┬───┘
       │                      │                      │                      │
       │                      │                      │ approve(pair, amtIn) │
       │                      │                      │◄─────────────────────┤
       │ swap(amt0Out,amt1Out,to,data)               │                      │
       ├─────────────────────────────────────────────►│                      │
       │                      │                      │ transferFrom(A,amtIn)│
       │                      │                      ├─────────────────────►│
       │                      │                      │ transfer(B,amtOut)   │
       │                      │                      ├─────────────────────►│
       │                      │                      │ update reserves      │
       │                      │                      │◄─────────────────────┤
       │                      │                      │                      │
   ┌───┴────────────────────────────────────────────────────────────────────┴───┐
   │                    4. REMOVING LIQUIDITY                                   │
   └───┬────────────────────────────────────────────────────────────────────┬───┘
       │                      │                      │                      │
       │ burn(to)             │                      │                      │
       ├─────────────────────────────────────────────►│                      │
       │                      │                      │ transfer(A,amount0)  │
       │                      │                      ├─────────────────────►│
       │                      │                      │ transfer(B,amount1)  │
       │                      │                      ├─────────────────────►│
       │ burn LP tokens       │                      │                      │
       │◄─────────────────────────────────────────────┤                      │
       │                      │                      │                      │
```

## 💰 Economics & Pricing

### Constant Product Formula
```
x * y = k (constant)
```

Where:
- `x` = Reserve of TokenA
- `y` = Reserve of TokenB  
- `k` = Constant (invariant)

### Price Calculation Example

```
                    BEFORE TRADE                           AFTER TRADE
                ┌─────────────────────┐               ┌─────────────────────┐
                │   Reserve TokenA    │               │   Reserve TokenA    │
                │    1000 tokens      │               │    1100 tokens      │
                └─────────┬───────────┘               └─────────┬───────────┘
                          │                                     │
                ┌─────────▼───────────┐               ┌─────────▼───────────┐
                │   Reserve TokenB    │               │   Reserve TokenB    │
                │    2000 tokens      │               │   ~1819 tokens      │
                └─────────┬───────────┘               └─────────┬───────────┘
                          │                                     │
                ┌─────────▼───────────┐               ┌─────────▼───────────┐
                │       Price         │               │     New Price       │
                │ 2000/1000 = 2.00    │               │  1819/1100 ≈ 1.65  │
                │                     │               │                     │
                │ 1 TokenA = 2 TokenB │               │ 1 TokenA = 1.65 TokenB
                └─────────────────────┘               └─────────────────────┘
                          ▲                                     ▲
                          │                                     │
                     Original State                      After selling 100 TokenA
                                                        User gets ~181 TokenB

                            Formula: k = x × y = 1000 × 2000 = 2,000,000
                            After trade: k = 1100 × 1819 = 2,000,900 (slightly higher due to fees)
```

### Fee Structure
- **Trading Fee**: 0.3% of each trade
- **LP Providers**: Get ~0.25% 
- **Protocol**: Gets ~0.05% (if feeTo is set)

## 🔧 Key Functions Explained

### Factory Functions

| Function | Purpose | Access |
|----------|---------|--------|
| `createPair(tokenA, tokenB)` | Creates new trading pair | Public |
| `getPair(tokenA, tokenB)` | Returns pair address | View |
| `allPairs(index)` | Returns pair at index | View |
| `setFeeTo(address)` | Sets protocol fee recipient | feeToSetter only |
| `setFeeToSetter(address)` | Changes governance | feeToSetter only |

### Pair Functions

| Function | Purpose | Access |
|----------|---------|--------|
| `mint(to)` | Add liquidity, mint LP tokens | Public |
| `burn(to)` | Remove liquidity, burn LP tokens | Public |
| `swap(amount0Out, amount1Out, to, data)` | Execute token swap | Public |
| `getReserves()` | Get current token reserves | View |
| `price0CumulativeLast()` | Oracle price data | View |

## 🛡️ Security Features

```
                    ┌─────────────────────────────────────────────────────┐
                    │                SECURITY MECHANISMS                  │
                    └─────────────────┬───────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────────┐
        │                             │                                 │
   ┌────▼────┐                  ┌────▼────┐                      ┌─────▼─────┐
   │🔒 LOCK  │                  │🔐 SAFE  │                      │🧮 SAFEMATH│
   │         │                  │TRANSFER │                      │           │
   │Reentrancy│                  │         │                      │Overflow   │
   │Protection│                  │Handles  │                      │Protection │
   └────┬────┘                  │Failures │                      └─────┬─────┘
        │                       └────┬────┘                            │
        │                            │                                 │
   ┌────▼────┐                  ┌────▼────┐                      ┌─────▼─────┐
   │PREVENTS:│                  │PREVENTS:│                      │PREVENTS:  │
   │         │                  │         │                      │           │
   │• Double │                  │• Failed │                      │• Integer  │
   │  calls  │                  │  tokens │                      │  overflow │
   │• Attack │                  │• Locked │                      │• Math     │
   │  vectors│                  │  funds  │                      │  errors   │
   └─────────┘                  └─────────┘                      └───────────┘

                               ┌─────────────────────┐
                               │   ✅ VALIDATION     │
                               │                     │
                               │ • Non-zero amounts  │
                               │ • Valid addresses   │
                               │ • Proper balances   │
                               │ • Authorized calls  │
                               └─────────────────────┘
```

## 🎯 Use Cases

### 1. **Decentralized Trading**
```
👤 TRADER                           � PAIR                         🤖 AMM ENGINE
   │                                   │                                │
   │ "I want TokenB"                   │                                │
   │ "I have TokenA"                   │                                │
   ├──────────────────────────────────►│                                │
   │                                   │ Calculate exchange rate        │
   │                                   ├───────────────────────────────►│
   │                                   │                                │
   │                                   │ Rate: 1 TokenA = 1.8 TokenB   │
   │                                   │◄───────────────────────────────┤
   │                                   │                                │
   │ Approve & Send 100 TokenA         │                                │
   ├──────────────────────────────────►│ Execute swap                   │
   │                                   ├───────────────────────────────►│
   │                                   │                                │
   │ Receive ~180 TokenB               │ Update reserves & pricing      │
   │◄──────────────────────────────────┤◄───────────────────────────────┤
```

### 2. **Liquidity Provision**
```
👤 LP PROVIDER                      💱 PAIR                         � REWARDS
   │                                   │                                │
   │ Deposit 1000 TokenA               │                                │
   │ Deposit 2000 TokenB               │                                │
   ├──────────────────────────────────►│                                │
   │                                   │ Mint LP tokens                 │
   │                                   │ = √(1000 × 2000) = 1414       │
   │                                   ├───────────────────────────────►│
   │                                   │                                │
   │ Receive 1414 LP tokens            │                                │
   │◄──────────────────────────────────┤                                │
   │                                   │                                │
   │        ... Time passes ...        │                                │
   │        Traders use pool           │ Collect 0.3% fees             │
   │                                   │◄───────────────────────────────┤
   │                                   │                                │
   │ Can redeem anytime for:           │                                │
   │ • Original tokens + fees          │                                │
   │◄──────────────────────────────────┤                                │
```

### 3. **Price Discovery & Arbitrage**
```
🏪 ARBITRAGEUR                      💱 OBOSWAP PAIR                 📊 EXTERNAL MARKET
   │                                   │                                │
   │ Check prices                      │                                │
   ├──────────────────────────────────►│ TokenA/TokenB = 1.8           │
   │                                   │                                │
   │                                   │                                │
   ├───────────────────────────────────────────────────────────────────►│ TokenA/TokenB = 2.0
   │                                   │                                │
   │ OPPORTUNITY DETECTED!             │                                │
   │ Buy cheap on Oboswap             │                                │
   │ Sell expensive on external        │                                │
   │                                   │                                │
   │ Buy TokenB with TokenA            │                                │
   ├──────────────────────────────────►│ Price moves toward 2.0         │
   │                                   │                                │
   │ Arbitrage continues until         │                                │
   │ prices are balanced               │                                │
   │◄──────────────────────────────────┤ Final price ≈ 2.0             │
```

## 🚀 Deployed Contracts (Thane Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **Factory** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Creates & manages pairs |
| **TokenA** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Test token for trading |
| **TokenB** | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | Test token for trading |
| **Pair** | `0x95f2EDe6aDC63329053E7E7feD420D725f84D9Fa` | TokenA/TokenB trading pair |

## 🔮 Future Enhancements

1. **Router Contract** - User-friendly interface for multi-hop swaps
2. **Governance Token** - Decentralized protocol governance  
3. **Farming Contracts** - Liquidity mining incentives
4. **Cross-chain Bridges** - Multi-network support
5. **Advanced Orders** - Limit orders, stop-loss, etc.

---

> **Note**: This is a Uniswap V2 fork customized for the Oboswap ecosystem. The core AMM mechanics remain the same while being optimized for the Thane network.

