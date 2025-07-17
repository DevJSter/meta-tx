// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMetaTransactionPaymaster
 * @dev Interface for paymaster contracts that sponsor meta-transactions
 * @author EIP2771 Paymaster Team
 */
interface IMetaTransactionPaymaster {
    /**
     * @dev Emitted when a transaction is sponsored
     */
    event TransactionSponsored(
        address indexed user,
        address indexed targetContract,
        uint256 gasUsed,
        uint256 feeCharged,
        address paymentToken,
        uint256 paymentAmount
    );

    /**
     * @dev Emitted when sponsorship settings are updated
     */
    event SponsorshipConfigUpdated(address indexed targetContract, bool sponsored);

    /**
     * @dev Emitted when funds are deposited or withdrawn
     */
    event FundsUpdated(address indexed user, uint256 amount, bool isDeposit);

    /**
     * @dev Check if a transaction can be sponsored by this paymaster
     * @param user The user requesting sponsorship
     * @param targetContract The contract being called
     * @param gasLimit The gas limit for the transaction
     * @return canSponsor True if the transaction can be sponsored
     */
    function canSponsorTransaction(address user, address targetContract, uint256 gasLimit)
        external
        view
        returns (bool canSponsor);

    /**
     * @dev Process payment for a sponsored transaction (called by forwarder)
     * @param user The user whose transaction was sponsored
     * @param targetContract The contract that was called
     * @param gasUsed The amount of gas used
     * @param gasPrice The gas price for the transaction
     */
    function processPayment(address user, address targetContract, uint256 gasUsed, uint256 gasPrice) external;

    /**
     * @dev Get estimated fee for sponsoring a transaction
     * @param gasLimit The gas limit for the transaction
     * @return estimatedFee The estimated fee in wei
     */
    function getEstimatedFee(uint256 gasLimit) external view returns (uint256 estimatedFee);

    /**
     * @dev Check if a user has sufficient credits for a transaction
     * @param user The user to check
     * @param gasLimit The gas limit for the transaction
     * @return hasCredits True if user has sufficient credits
     */
    function hassufficientCredits(address user, uint256 gasLimit) external view returns (bool hasCredits);
}
