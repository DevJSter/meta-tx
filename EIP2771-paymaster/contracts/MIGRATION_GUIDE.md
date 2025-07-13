# Migration Guide: From Legacy to Professional EIP2771 System

## Quick Migration Reference

### Contract Names
```solidity
// OLD
import "./Forwarder.sol";
import "./Paymaster.sol";
MinimalForwarder forwarder;
Paymaster paymaster;

// NEW
import "./EIP2771Forwarder.sol";
import "./MetaTransactionPaymaster.sol";
EIP2771Forwarder forwarder;
MetaTransactionPaymaster paymaster;
```

### Function Names
```solidity
// OLD
forwarder.execute(req, signature);
forwarder.executeViaPaymaster(req, signature, paymaster);
paymaster.payForTransaction(user, target, gasUsed, gasPrice);

// NEW
forwarder.executeMetaTransaction(req, signature);
forwarder.executeSponsoredTransaction(req, signature, paymaster);
paymaster.processPayment(user, target, gasUsed, gasPrice);
```

### Struct References
```solidity
// OLD
MinimalForwarder.ForwardRequest memory req;

// NEW
IEIP2771Forwarder.ForwardRequest memory req;
```

### Event Names
```solidity
// OLD
event ForwardRequestExecuted(...);

// NEW
event MetaTransactionExecuted(...);
```

### Error Messages
```solidity
// OLD
"MinimalForwarder: signature does not match request"

// NEW
"EIP2771Forwarder: signature does not match request"
```

## File Organization

### Before
```
src/
├── Forwarder.sol
├── Paymaster.sol
├── OwnerFundedPaymaster.sol
├── SampleContract.sol
├── IEIP2771Forwarder.sol
└── IMetaTransactionPaymaster.sol
```

### After
```
src/
├── EIP2771Forwarder.sol
├── MetaTransactionPaymaster.sol
├── OwnerFundedPaymaster.sol
├── EIP2771ForwarderTestContract.sol
├── interfaces/
│   ├── IEIP2771Forwarder.sol
│   └── IMetaTransactionPaymaster.sol
└── libraries/
    ├── EIP2771Utils.sol
    └── PaymasterUtils.sol
```

## Import Updates Required
```solidity
// Update interface imports
import "./interfaces/IEIP2771Forwarder.sol";
import "./interfaces/IMetaTransactionPaymaster.sol";

// Update library imports
import "./libraries/EIP2771Utils.sol";
import "./libraries/PaymasterUtils.sol";
```

## Test Migration
```solidity
// OLD
import "../src/Forwarder.sol";
contract ForwarderTest {
    MinimalForwarder forwarder;
    
    function test() {
        forwarder.execute(req, sig);
    }
}

// NEW
import "../src/EIP2771Forwarder.sol";
import "../src/interfaces/IEIP2771Forwarder.sol";
contract EIP2771ForwarderTest {
    EIP2771Forwarder forwarder;
    
    function test() {
        forwarder.executeMetaTransaction(req, sig);
    }
}
```

## Status
- ✅ Core contracts migrated and compiling
- ⚠️ Legacy test files need updating
- ✅ New professional test suite created
- ✅ Deployment scripts updated
- ✅ Documentation updated
