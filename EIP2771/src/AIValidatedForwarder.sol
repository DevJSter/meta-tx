// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AIValidatedForwarder
 * @dev EIP-2771 compliant forwarder with AI validation
 * This contract extends OpenZeppelin's ERC2771Forwarder to add AI validation logic
 */
contract AIValidatedForwarder is ERC2771Forwarder, Ownable {
    // Events
    event InteractionValidated(address indexed from, string interaction, bool isValid);
    event AIValidationRuleUpdated(string rule, bool isActive);
    
    // AI validation rules mapping
    mapping(string => bool) public validInteractionPrefixes;
    
    // Constructor
    constructor(string memory name) ERC2771Forwarder(name) Ownable(msg.sender) {
        // Initialize with default AI validation rules
        validInteractionPrefixes["liked_"] = true;
        validInteractionPrefixes["comment_"] = true;
        validInteractionPrefixes["share_"] = true;
        validInteractionPrefixes["follow_"] = true;
    }
    
    /**
     * @dev Add or remove AI validation rules
     * @param prefix The interaction prefix to validate
     * @param isValid Whether this prefix should be considered valid
     */
    function setValidationRule(string memory prefix, bool isValid) external onlyOwner {
        validInteractionPrefixes[prefix] = isValid;
        emit AIValidationRuleUpdated(prefix, isValid);
    }
    
    /**
     * @dev Validate interaction using AI rules
     * @param interaction The interaction string to validate
     * @return bool Whether the interaction is valid
     */
    function validateInteraction(string memory interaction) public view returns (bool) {
        bytes memory interactionBytes = bytes(interaction);
        
        // Check against all valid prefixes
        if (validInteractionPrefixes["liked_"] && _startsWith(interactionBytes, "liked_")) return true;
        if (validInteractionPrefixes["comment_"] && _startsWith(interactionBytes, "comment_")) return true;
        if (validInteractionPrefixes["share_"] && _startsWith(interactionBytes, "share_")) return true;
        if (validInteractionPrefixes["follow_"] && _startsWith(interactionBytes, "follow_")) return true;
        if (validInteractionPrefixes["vote_"] && _startsWith(interactionBytes, "vote_")) return true;
        
        return false;
    }
    
    /**
     * @dev Execute a meta-transaction with AI validation
     * @param request The forwarding request containing the meta-transaction data and signature
     */
    function executeWithValidation(ForwardRequestData calldata request) external payable {
        // Verify the signature first
        bool isValidSignature = verify(request);
        require(isValidSignature, "AIValidatedForwarder: invalid signature");
        
        // Extract interaction from calldata (assuming it's passed as a parameter)
        // This is a simplified approach - in practice, you'd decode the actual function call
        string memory interaction = _extractInteractionFromCalldata(request.data);
        
        // Validate interaction with AI rules
        bool isValidInteraction = validateInteraction(interaction);
        
        emit InteractionValidated(request.from, interaction, isValidInteraction);
        
        if (!isValidInteraction) {
            revert("AIValidatedForwarder: interaction rejected by AI validation");
        }
        
        // Execute the meta-transaction if validation passes
        execute(request);
    }
    
    /**
     * @dev Helper function to check if bytes start with a prefix
     */
    function _startsWith(bytes memory data, string memory prefix) internal pure returns (bool) {
        bytes memory prefixBytes = bytes(prefix);
        if (data.length < prefixBytes.length) return false;
        
        for (uint i = 0; i < prefixBytes.length; i++) {
            if (data[i] != prefixBytes[i]) return false;
        }
        return true;
    }
    
    /**
     * @dev Extract interaction string from calldata
     * This is a simplified implementation - adjust based on your target contract's interface
     */
    function _extractInteractionFromCalldata(bytes calldata data) internal pure returns (string memory) {
        // For executeInteraction(string) function
        // Skip function selector (4 bytes) and extract the string parameter
        if (data.length < 68) return ""; // 4 bytes selector + 32 bytes offset + 32 bytes length
        
        // The string parameter starts at offset 0x20 (32 bytes) after the function selector
        uint256 stringOffset;
        uint256 stringLength;
        
        assembly {
            // Skip the function selector (4 bytes) and read the offset to the string
            stringOffset := calldataload(add(data.offset, 4))
            // Read the length of the string at the offset
            stringLength := calldataload(add(add(data.offset, 4), stringOffset))
        }
        
        if (stringLength == 0 || stringLength > 1000) return ""; // Sanity check
        
        // Extract the actual string bytes
        bytes memory result = new bytes(stringLength);
        uint256 dataStart = 4 + stringOffset + 32; // 4 (selector) + offset + 32 (length field)
        
        for (uint256 i = 0; i < stringLength; i++) {
            result[i] = data[dataStart + i];
        }
        
        return string(result);
    }
}
