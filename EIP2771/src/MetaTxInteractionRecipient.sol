// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title MetaTxInteractionRecipient
 * @dev A recipient contract that accepts meta-transactions via EIP-2771 forwarder
 * This contract handles user interactions and is designed to work with the AIValidatedForwarder
 */
contract MetaTxInteractionRecipient is ERC2771Context {
    // Mapping to store user interactions
    mapping(address => string[]) public userInteractions;
    mapping(address => uint256) public interactionCount;
    
    // Events
    event InteractionExecuted(
        address indexed user, 
        string interaction, 
        uint256 timestamp,
        bool viaMeta
    );
    
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}
    
    /**
     * @dev Execute an interaction (can be called directly or via meta-transaction)
     * @param interaction The interaction string to execute
     */
    function executeInteraction(string memory interaction) external {
        address user = _msgSender(); // This will be the original user even in meta-tx
        
        // Store the interaction
        userInteractions[user].push(interaction);
        interactionCount[user]++;
        
        // Emit event indicating whether this came via meta-transaction
        bool viaMeta = _msgSender() != msg.sender;
        
        emit InteractionExecuted(user, interaction, block.timestamp, viaMeta);
    }
    
    /**
     * @dev Get all interactions for a user
     * @param user The user address
     * @return Array of interaction strings
     */
    function getUserInteractions(address user) external view returns (string[] memory) {
        return userInteractions[user];
    }
    
    /**
     * @dev Get the number of interactions for a user
     * @param user The user address
     * @return Number of interactions
     */
    function getUserInteractionCount(address user) external view returns (uint256) {
        return interactionCount[user];
    }
    
    /**
     * @dev Get the latest interaction for a user
     * @param user The user address
     * @return The latest interaction string
     */
    function getLatestInteraction(address user) external view returns (string memory) {
        require(interactionCount[user] > 0, "No interactions found");
        return userInteractions[user][interactionCount[user] - 1];
    }
    
    /**
     * @dev Check if this transaction came via the trusted forwarder
     * @return True if this is a meta-transaction
     */
    function isMetaTransaction() external view returns (bool) {
        return _msgSender() != msg.sender;
    }
}
