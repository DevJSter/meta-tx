// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PaymasterUtils
 * @dev Utility library for paymaster operations
 */
library PaymasterUtils {
    /**
     * @dev Calculate the estimated fee for a transaction
     */
    function calculateEstimatedFee(
        uint256 gasLimit,
        uint256 gasPrice,
        uint256 baseFee,
        uint256 feeMultiplier
    ) internal pure returns (uint256) {
        if (gasPrice == 0) {
            gasPrice = 1 gwei; // Default gas price
        }
        return ((gasLimit + baseFee) * gasPrice * feeMultiplier) / 100;
    }
    
    /**
     * @dev Validate sponsorship parameters
     */
    function validateSponsorshipParams(
        address user,
        address target,
        uint256 gasLimit,
        uint256 maxGasLimit,
        mapping(address => bool) storage sponsoredContracts
    ) internal view returns (bool) {
        return user != address(0) && 
               target != address(0) && 
               gasLimit > 0 && 
               gasLimit <= maxGasLimit && 
               sponsoredContracts[target];
    }
    
    /**
     * @dev Check if user has sufficient credits
     */
    function hasSufficientCredits(
        address user,
        uint256 requiredAmount,
        mapping(address => uint256) storage userCredits
    ) internal view returns (bool) {
        return userCredits[user] >= requiredAmount;
    }
    
    /**
     * @dev Check if token is whitelisted
     */
    function isTokenWhitelisted(
        address token,
        mapping(address => bool) storage whitelistedTokens
    ) internal view returns (bool) {
        return whitelistedTokens[token];
    }
}
