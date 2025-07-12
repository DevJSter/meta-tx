// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SampleERC2771Contract
 * @dev Sample contract that supports EIP2771 meta-transactions
 */
contract SampleERC2771Contract is ERC2771Context, Ownable {
    mapping(address => uint256) public balances;
    mapping(address => string) public userMessages;
    
    event BalanceUpdated(address indexed user, uint256 newBalance);
    event MessageUpdated(address indexed user, string message);
    
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}
    
    /**
     * @dev Update user balance (using meta-transaction sender)
     */
    function updateBalance(uint256 amount) external {
        address user = _msgSender(); // This will be the original sender, not the forwarder
        balances[user] += amount;
        emit BalanceUpdated(user, balances[user]);
    }
    
    /**
     * @dev Set user message (using meta-transaction sender)
     */
    function setMessage(string calldata message) external {
        address user = _msgSender(); // This will be the original sender, not the forwarder
        userMessages[user] = message;
        emit MessageUpdated(user, message);
    }
    
    /**
     * @dev Get user balance
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @dev Get user message
     */
    function getMessage(address user) external view returns (string memory) {
        return userMessages[user];
    }
    
    /**
     * @dev Override to use ERC2771Context version
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    /**
     * @dev Override to use ERC2771Context version
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
}
