// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEIP2771Forwarder
 * @dev Interface for EIP-2771 compliant meta-transaction forwarders
 * @author EIP2771 Paymaster Team
 */
interface IEIP2771Forwarder {
    /**
     * @dev Structure representing a forward request for meta-transactions
     */
    struct ForwardRequest {
        address from; // Original transaction sender
        address to; // Target contract address
        uint256 value; // ETH value to send
        uint256 gas; // Gas limit for execution
        uint256 nonce; // Sender's current nonce
        bytes data; // Encoded function call data
    }

    /**
     * @dev Emitted when a meta-transaction is executed
     */
    event MetaTransactionExecuted(
        address indexed originalSender,
        address indexed targetContract,
        uint256 value,
        uint256 gasLimit,
        uint256 nonce,
        bytes data,
        bool success
    );

    /**
     * @dev Emitted when a paymaster is added or removed
     */
    event PaymasterStatusUpdated(address indexed paymaster, bool trusted);

    /**
     * @dev Get the current nonce for a given address
     * @param user The address to query nonce for
     * @return Current nonce value
     */
    function getNonce(address user) external view returns (uint256);

    /**
     * @dev Verify a forward request signature
     * @param request The forward request to verify
     * @param signature The signature to verify
     * @return True if signature is valid
     */
    function verifySignature(ForwardRequest calldata request, bytes calldata signature) external view returns (bool);

    /**
     * @dev Execute a meta-transaction (caller pays gas)
     * @param request The forward request to execute
     * @param signature The signature proving request validity
     * @return success Whether the execution succeeded
     * @return returnData Return data from the executed call
     */
    function executeMetaTransaction(ForwardRequest calldata request, bytes calldata signature)
        external
        payable
        returns (bool success, bytes memory returnData);

    /**
     * @dev Execute a meta-transaction with paymaster sponsorship
     * @param request The forward request to execute
     * @param signature The signature proving request validity
     * @param paymaster The paymaster contract address
     * @return success Whether the execution succeeded
     * @return returnData Return data from the executed call
     */
    function executeSponsoredTransaction(ForwardRequest calldata request, bytes calldata signature, address paymaster)
        external
        returns (bool success, bytes memory returnData);

    /**
     * @dev Check if this forwarder is trusted by target contracts
     * @param forwarder Address to check
     * @return True if this is the trusted forwarder
     */
    function isTrustedForwarder(address forwarder) external view returns (bool);
}
