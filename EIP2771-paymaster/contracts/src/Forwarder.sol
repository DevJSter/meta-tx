// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MinimalForwarder
 * @dev EIP-2771 compliant forwarder for meta-transactions
 */
contract MinimalForwarder is EIP712, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    mapping(address => uint256) private _nonces;
    mapping(address => bool) public trustedPaymasters;

    event ForwardRequestExecuted(
        address indexed from,
        address indexed to,
        uint256 value,
        uint256 gas,
        uint256 nonce,
        bytes data,
        bool success
    );

    event PaymasterAdded(address indexed paymaster);
    event PaymasterRemoved(address indexed paymaster);

    modifier onlyTrustedPaymaster() {
        require(trustedPaymasters[msg.sender], "MinimalForwarder: caller is not a trusted paymaster");
        _;
    }

    constructor() EIP712("MinimalForwarder", "0.0.1") {}

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
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
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
     * @dev Execute a forward request (can be called by anyone)
     */
    function execute(ForwardRequest calldata req, bytes calldata signature) 
        public 
        payable 
        nonReentrant 
        returns (bool success, bytes memory returndata) 
    {
        require(verify(req, signature), "MinimalForwarder: signature does not match request");
        
        _nonces[req.from] = req.nonce + 1;

        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the transaction used less gas than the one provided
        require(gasleft() > req.gas / 63, "MinimalForwarder: insufficient gas");

        emit ForwardRequestExecuted(req.from, req.to, req.value, req.gas, req.nonce, req.data, success);
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
        require(verify(req, signature), "MinimalForwarder: signature does not match request");
        
        _nonces[req.from] = req.nonce + 1;

        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the transaction used less gas than the one provided
        require(gasleft() > req.gas / 63, "MinimalForwarder: insufficient gas");

        emit ForwardRequestExecuted(req.from, req.to, req.value, req.gas, req.nonce, req.data, success);
    }

    /**
     * @dev Check if forwarder is trusted for target contract
     */
    function isTrustedForwarder(address forwarder) external view returns (bool) {
        return forwarder == address(this);
    }
}
