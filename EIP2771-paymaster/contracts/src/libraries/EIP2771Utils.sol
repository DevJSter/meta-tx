// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EIP2771Utils
 * @dev Utility library for EIP-2771 meta-transaction operations
 */
library EIP2771Utils {
    /**
     * @dev Extract the original sender from meta-transaction data
     */
    function extractSender(bytes calldata data) internal pure returns (address sender) {
        if (data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(add(data.offset, sub(data.length, 20))))
            }
        }
    }
    
    /**
     * @dev Extract the original data from meta-transaction data
     */
    function extractData(bytes calldata data) internal pure returns (bytes calldata originalData) {
        if (data.length >= 20) {
            originalData = data[:data.length - 20];
        } else {
            originalData = data;
        }
    }
    
    /**
     * @dev Calculate the gas cost for a transaction
     */
    function calculateGasCost(
        uint256 gasUsed,
        uint256 gasPrice,
        uint256 baseFee,
        uint256 multiplier
    ) internal pure returns (uint256) {
        return ((gasUsed + baseFee) * gasPrice * multiplier) / 100;
    }
    
    /**
     * @dev Validate gas limit is within acceptable bounds
     */
    function validateGasLimit(uint256 gasLimit, uint256 maxGasLimit) internal pure returns (bool) {
        return gasLimit > 0 && gasLimit <= maxGasLimit;
    }
}
