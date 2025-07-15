// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEIP2771Forwarder.sol";

/**
 * @title EIP2771Forwarder
 * @dev Professional EIP-2771 compliant forwarder for meta-transactions
 * @notice This contract enables gasless transactions through meta-transaction support
 */
contract EIP2771Forwarder is IEIP2771Forwarder, EIP712, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    mapping(address => uint256) private _nonces;
    mapping(address => bool) public trustedPaymasters;

    event PaymasterAdded(address indexed paymaster);
    event PaymasterRemoved(address indexed paymaster);

    modifier onlyTrustedPaymaster() {
        require(trustedPaymasters[msg.sender], "EIP2771Forwarder: caller is not a trusted paymaster");
        _;
    }

    constructor(address initialOwner) EIP712("EIP2771Forwarder", "1.0.0") Ownable(initialOwner) {}

    /**
     * @dev Add a trusted paymaster
     */
    function addTrustedPaymaster(address paymaster) external onlyOwner {
        trustedPaymasters[paymaster] = true;
        emit PaymasterAdded(paymaster);
    }

    /**
     * @dev Remove a trusted paymaster
     */
    function removeTrustedPaymaster(address paymaster) external onlyOwner {
        trustedPaymasters[paymaster] = false;
        emit PaymasterRemoved(paymaster);
    }

    /**
     * @dev Get the current nonce for a given address
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @dev Verify a forward request signature
     */
    function verifySignature(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @dev Legacy verify function for backward compatibility
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        return verifySignature(req, signature);
    }

    /**
     * @dev Execute a forward request (can be called by anyone)
     */
    function executeMetaTransaction(ForwardRequest calldata req, bytes calldata signature) 
        public 
        payable 
        nonReentrant 
        returns (bool success, bytes memory returndata) 
    {
        require(verifySignature(req, signature), "EIP2771Forwarder: signature does not match request");
        
        _nonces[req.from] = req.nonce + 1;

        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the transaction used less gas than the one provided
        require(gasleft() > req.gas / 63, "EIP2771Forwarder: insufficient gas");

        emit MetaTransactionExecuted(req.from, req.to, req.value, req.gas, req.nonce, req.data, success);
    }

    /**
     * @dev Execute a forward request via paymaster (only trusted paymasters can call)
     */
    function executeWithPaymaster(ForwardRequest calldata req, bytes calldata signature) 
        public 
        payable 
        onlyTrustedPaymaster
        nonReentrant 
        returns (bool success, bytes memory returndata) 
    {
        require(verifySignature(req, signature), "EIP2771Forwarder: signature does not match request");
        
        _nonces[req.from] = req.nonce + 1;

        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the transaction used less gas than the one provided
        require(gasleft() > req.gas / 63, "EIP2771Forwarder: insufficient gas");

        emit MetaTransactionExecuted(req.from, req.to, req.value, req.gas, req.nonce, req.data, success);
    }

    /**
     * @dev Execute a forward request via paymaster (can be called by anyone)
     * This function verifies signature, executes transaction, then asks paymaster to pay
     */
    function executeSponsoredTransaction(ForwardRequest calldata req, bytes calldata signature, address paymaster) 
        public 
        nonReentrant 
        returns (bool success, bytes memory returndata) 
    {
        require(verifySignature(req, signature), "EIP2771Forwarder: signature does not match request");
        require(trustedPaymasters[paymaster], "EIP2771Forwarder: paymaster not trusted");
        
        // Check with paymaster if they can sponsor this transaction
        (bool callSuccess, bytes memory result) = paymaster.call(
            abi.encodeWithSignature("canSponsorTransaction(address,address,uint256)", req.from, req.to, req.gas)
        );
        
        require(callSuccess && result.length > 0 && abi.decode(result, (bool)), "EIP2771Forwarder: transaction cannot be sponsored");
        
        // Execute the transaction
        _nonces[req.from] = req.nonce + 1;
        
        uint256 gasStart = gasleft();
        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );
        
        // Validate that the transaction used less gas than the one provided
        require(gasleft() > req.gas / 63, "EIP2771Forwarder: insufficient gas");
        
        // Ask paymaster to pay for the transaction
        (bool paymentSuccess,) = paymaster.call(
            abi.encodeWithSignature("processPayment(address,address,uint256,uint256)", req.from, req.to, gasStart - gasleft() + 21000, tx.gasprice)
        );
        require(paymentSuccess, "EIP2771Forwarder: payment processing failed");
        
        emit MetaTransactionExecuted(req.from, req.to, req.value, req.gas, req.nonce, req.data, success);
    }

    /**
     * @dev Execute a forward request via paymaster with token payment (can be called by anyone)
     */
    function executeSponsoredTransactionWithToken(
        ForwardRequest calldata req, 
        bytes calldata signature, 
        address paymaster, 
        address paymentToken, 
        uint256 paymentAmount
    ) 
        public 
        nonReentrant 
        returns (bool success, bytes memory returndata) 
    {
        require(verifySignature(req, signature), "EIP2771Forwarder: signature does not match request");
        require(trustedPaymasters[paymaster], "EIP2771Forwarder: paymaster not trusted");
        
        // Call the paymaster to sponsor the transaction with token payment
        (success, returndata) = paymaster.call(
            abi.encodeWithSignature(
                "sponsorTransactionWithToken((address,address,uint256,uint256,uint256,bytes),bytes,address,uint256)", 
                req, 
                signature,
                paymentToken,
                paymentAmount
            )
        );
        
        require(success, "EIP2771Forwarder: paymaster call failed");
    }

    /**
     * @dev Check if forwarder is trusted for target contract
     */
    function isTrustedForwarder(address forwarder) external view returns (bool) {
        return forwarder == address(this);
    }
}
