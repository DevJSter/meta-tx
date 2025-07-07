// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AIValidatedForwarder
 * @dev EIP-2771 compliant forwarder with Ollama AI validation
 * This contract extends OpenZeppelin's ERC2771Forwarder to add AI validation logic
 */
contract AIValidatedForwarder is ERC2771Forwarder, Ownable {
    // Events
    event InteractionValidated(address indexed from, string interaction, bool isValid, uint256 significance);
    event AIValidationRuleUpdated(string rule, bool isActive);
    event AIValidatorUpdated(address indexed oldValidator, address indexed newValidator);
    
    // AI validation rules mapping
    mapping(string => bool) public validInteractionPrefixes;
    
    // AI Validator address (can be a service contract or EOA)
    address public aiValidator;
    
    // Significance thresholds (in basis points, 10000 = 100%)
    uint256 public approvalThreshold = 7000; // 70%
    uint256 public rejectionThreshold = 3000; // 30%
    
    // Constructor
    constructor(string memory name) ERC2771Forwarder(name) Ownable(msg.sender) {
        // Initialize with default AI validation rules
        validInteractionPrefixes["liked_"] = true;
        validInteractionPrefixes["comment_"] = true;
        validInteractionPrefixes["share_"] = true;
        validInteractionPrefixes["follow_"] = true;
    }
    
    /**
     * @dev Set the AI validator address
     * @param _aiValidator Address of the AI validation service
     */
    function setAIValidator(address _aiValidator) external onlyOwner {
        address oldValidator = aiValidator;
        aiValidator = _aiValidator;
        emit AIValidatorUpdated(oldValidator, _aiValidator);
    }
    
    /**
     * @dev Set significance thresholds
     * @param _approvalThreshold Threshold for approval (in basis points)
     * @param _rejectionThreshold Threshold for rejection (in basis points)
     */
    function setThresholds(uint256 _approvalThreshold, uint256 _rejectionThreshold) external onlyOwner {
        require(_approvalThreshold > _rejectionThreshold, "Invalid thresholds");
        require(_approvalThreshold <= 10000, "Approval threshold too high");
        approvalThreshold = _approvalThreshold;
        rejectionThreshold = _rejectionThreshold;
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
     * @dev Validate interaction using basic rules (fallback)
     * @param interaction The interaction string to validate
     * @return bool Whether the interaction is valid
     */
    function validateInteractionBasic(string memory interaction) public view returns (bool) {
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
        
        // Extract interaction from calldata
        string memory interaction = _extractInteractionFromCalldata(request.data);
        
        // For now, use basic validation (can be enhanced with Ollama integration)
        bool isValidInteraction = validateInteractionBasic(interaction);
        
        // Default significance for basic validation
        uint256 significance = isValidInteraction ? 8000 : 2000; // 80% or 20%
        
        emit InteractionValidated(request.from, interaction, isValidInteraction, significance);
        
        if (!isValidInteraction) {
            revert("AIValidatedForwarder: interaction rejected by AI validation");
        }
        
        // Execute the meta-transaction if validation passes
        execute(request);
    }
    
    /**
     * @dev Execute with external AI validation result
     * @param request The forwarding request
     * @param aiApproved Whether AI approved the interaction
     * @param significance The AI confidence level (0-10000 basis points)
     */
    function executeWithAIResult(
        ForwardRequestData calldata request,
        bool aiApproved,
        uint256 significance
    ) external payable {
        require(msg.sender == aiValidator || msg.sender == owner(), "Unauthorized AI validation");
        
        // Verify the signature first
        bool isValidSignature = verify(request);
        require(isValidSignature, "AIValidatedForwarder: invalid signature");
        
        // Extract interaction for logging
        string memory interaction = _extractInteractionFromCalldata(request.data);
        
        // Make decision based on AI result and significance
        bool finalDecision = _makeFinalDecision(aiApproved, significance);
        
        emit InteractionValidated(request.from, interaction, finalDecision, significance);
        
        if (!finalDecision) {
            revert("AIValidatedForwarder: interaction rejected by AI validation");
        }
        
        // Execute the meta-transaction if validation passes
        execute(request);
    }
    
    /**
     * @dev Make final decision based on AI result and significance thresholds
     */
    function _makeFinalDecision(bool aiApproved, uint256 significance) internal view returns (bool) {
        if (significance >= approvalThreshold && aiApproved) {
            return true; // High confidence approval
        }
        
        if (significance >= approvalThreshold && !aiApproved) {
            return false; // High confidence rejection
        }
        
        if (significance <= rejectionThreshold) {
            return false; // Low confidence, default to rejection
        }
        
        // Medium confidence - use AI decision
        return aiApproved;
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
     * This extracts the interaction parameter from executeInteraction(string) calls
     */
    function _extractInteractionFromCalldata(bytes calldata data) internal pure returns (string memory) {
        // For executeInteraction(string) function
        // Function selector: 4 bytes
        // String offset: 32 bytes  
        // String length: 32 bytes
        // String data: length bytes
        
        if (data.length < 68) return ""; // 4 + 32 + 32 minimum
        
        uint256 stringLength;
        
        // Read the length of the string (at offset 36: 4 bytes selector + 32 bytes offset)
        assembly {
            stringLength := calldataload(add(data.offset, 36))
        }
        
        if (stringLength == 0 || stringLength > 1000) return ""; // Sanity check
        
        // Extract the actual string bytes starting at offset 68 (4 + 32 + 32)
        bytes memory result = new bytes(stringLength);
        
        for (uint256 i = 0; i < stringLength; i++) {
            result[i] = data[68 + i];
        }
        
        return string(result);
    }
}
