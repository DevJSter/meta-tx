// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QOBIAccessControl
 * @dev Role-based access control for the QOBI social mining system
 */
contract QOBIAccessControl is Ownable {
    mapping(bytes32 => mapping(address => bool)) public roles;
    
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    
    constructor() Ownable(msg.sender) {}
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: sender lacks role");
        _;
    }
    
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return roles[role][account];
    }
    
    function grantRole(bytes32 role, address account) external onlyOwner {
        _grantRole(role, account);
    }
    
    function revokeRole(bytes32 role, address account) external onlyOwner {
        _revokeRole(role, account);
    }
    
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }
    
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }
    
    // Role constants
    function AI_VALIDATOR_ROLE() external pure returns (bytes32) {
        return keccak256("AI_VALIDATOR_ROLE");
    }
    
    function RELAYER_ROLE() external pure returns (bytes32) {
        return keccak256("RELAYER_ROLE");
    }
    
    function STABILIZER_ROLE() external pure returns (bytes32) {
        return keccak256("STABILIZER_ROLE");
    }
    
    function DISTRIBUTOR_ROLE() external pure returns (bytes32) {
        return keccak256("DISTRIBUTOR_ROLE");
    }
    
    function TREE_GENERATOR_ROLE() external pure returns (bytes32) {
        return keccak256("TREE_GENERATOR_ROLE");
    }
}
