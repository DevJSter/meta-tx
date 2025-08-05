// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./QOBIAccessControl.sol";
import "./StabilizingContract.sol";
import "./DailyTreeGenerator.sol";
import "./QOBIMerkleDistributor.sol";
import "./RelayerTreasury.sol";

/**
 * @title QOBISystemDeployer
 * @dev Deployment and setup helper contract for the complete QOBI social mining system
 */
contract QOBISystemDeployer is Ownable {
    QOBIAccessControl public accessControl;
    StabilizingContract public stabilizingContract;
    DailyTreeGenerator public treeGenerator;
    QOBIMerkleDistributor public merkleDistributor; 
    RelayerTreasury public relayerTreasury;
    
    event SystemDeployed(
        address accessControl,
        address stabilizing,
        address treeGenerator,
        address merkleDistributor,
        address relayerTreasury
    );
    
    event SystemConfigured(
        address indexed aiValidator,
        address indexed relayer,
        address indexed stabilizer
    );
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Deploy the complete QOBI social mining system
     * @return _accessControl Address of access control contract
     * @return _stabilizing Address of stabilizing contract
     * @return _treeGenerator Address of tree generator contract
     * @return _merkleDistributor Address of merkle distributor contract
     * @return _relayerTreasury Address of relayer treasury contract
     */
    function deployCompleteSystem() public onlyOwner returns (
        address _accessControl,
        address _stabilizing,
        address _treeGenerator,
        address _merkleDistributor,
        address _relayerTreasury
    ) {
        // Deploy Access Control first
        accessControl = new QOBIAccessControl();
        
        // Deploy Stabilizing Contract
        stabilizingContract = new StabilizingContract(address(accessControl));
        
        // Deploy Tree Generator
        treeGenerator = new DailyTreeGenerator(address(accessControl));
        
        // Deploy Merkle Distributor
        merkleDistributor = new QOBIMerkleDistributor(address(accessControl));
        
        // Deploy Relayer Treasury
        relayerTreasury = new RelayerTreasury(address(accessControl));
        
        // Setup cross-contract connections
        _setupSystemConnections();
        
        // Grant initial roles
        _setupInitialRoles();
        
        emit SystemDeployed(
            address(accessControl),
            address(stabilizingContract),
            address(treeGenerator),
            address(merkleDistributor),
            address(relayerTreasury)
        );
        
        return (
            address(accessControl),
            address(stabilizingContract),
            address(treeGenerator),
            address(merkleDistributor),
            address(relayerTreasury)
        );
    }
    
    /**
     * @dev Setup connections between contracts
     */
    function _setupSystemConnections() internal {
        // Stabilizing contract connections
        stabilizingContract.setMerkleDistributor(address(merkleDistributor));
        
        // Tree generator connections
        treeGenerator.setMerkleDistributor(address(merkleDistributor));
        
        // Merkle distributor connections
        merkleDistributor.setStabilizingContract(payable(address(stabilizingContract)));
        
        // Relayer treasury connections
        relayerTreasury.setStabilizingContract(address(stabilizingContract));
    }
    
    /**
     * @dev Setup initial roles for the system
     */
    function _setupInitialRoles() internal {
        // Grant distributor role to tree generator
        accessControl.grantRole(keccak256("DISTRIBUTOR_ROLE"), address(treeGenerator));
        
        // Grant initial admin roles to deployer (owner)
        accessControl.grantRole(keccak256("TREE_GENERATOR_ROLE"), owner());
        accessControl.grantRole(keccak256("AI_VALIDATOR_ROLE"), owner());
        accessControl.grantRole(keccak256("STABILIZER_ROLE"), owner());
        accessControl.grantRole(keccak256("RELAYER_ROLE"), owner());
    }
    
    /**
     * @dev Setup initial configuration with specific addresses
     * @param aiValidator Address to grant AI validator role
     * @param relayer Address to grant relayer role and add to treasury
     * @param stabilizer Address to grant stabilizer role
     */
    function setupInitialConfiguration(
        address aiValidator,
        address relayer,
        address stabilizer
    ) public onlyOwner {
        require(address(accessControl) != address(0), "QOBISystemDeployer: System not deployed");
        
        // Grant roles to specific addresses
        if (aiValidator != address(0)) {
            accessControl.grantRole(keccak256("AI_VALIDATOR_ROLE"), aiValidator);
        }
        
        if (relayer != address(0)) {
            accessControl.grantRole(keccak256("RELAYER_ROLE"), relayer);
            relayerTreasury.addRelayer(relayer);
            treeGenerator.authorizeRelayer(relayer);
            stabilizingContract.authorizeRelayer(relayer);
        }
        
        if (stabilizer != address(0)) {
            accessControl.grantRole(keccak256("STABILIZER_ROLE"), stabilizer);
        }
        
        emit SystemConfigured(aiValidator, relayer, stabilizer);
    }
    
    /**
     * @dev Add multiple relayers to the system
     * @param relayers Array of relayer addresses
     */
    function addMultipleRelayers(address[] calldata relayers) public onlyOwner {
        require(address(relayerTreasury) != address(0), "QOBISystemDeployer: System not deployed");
        
        for (uint256 i = 0; i < relayers.length; i++) {
            if (relayers[i] != address(0)) {
                accessControl.grantRole(keccak256("RELAYER_ROLE"), relayers[i]);
                relayerTreasury.addRelayer(relayers[i]);
                treeGenerator.authorizeRelayer(relayers[i]);
                stabilizingContract.authorizeRelayer(relayers[i]);
            }
        }
    }
    
    /**
     * @dev Fund multiple relayers with equal amounts
     * @param relayers Array of relayer addresses
     * @param amountPerRelayer Amount to fund each relayer
     */
    function fundMultipleRelayers(
        address[] calldata relayers,
        uint256 amountPerRelayer
    ) public payable onlyOwner {
        require(address(relayerTreasury) != address(0), "QOBISystemDeployer: System not deployed");
        require(msg.value >= relayers.length * amountPerRelayer, "QOBISystemDeployer: Insufficient funds");
        
        // Send funds to relayer treasury
        payable(address(relayerTreasury)).transfer(msg.value);
        
        // Fund each relayer
        for (uint256 i = 0; i < relayers.length; i++) {
            if (relayers[i] != address(0)) {
                relayerTreasury.fundRelayer(relayers[i], amountPerRelayer);
            }
        }
    }
    
    /**
     * @dev Setup system with initial funding
     * @param aiValidator Address for AI validator
     * @param relayers Array of relayer addresses
     * @param stabilizer Address for stabilizer
     * @param initialRelayerFunding Amount to fund each relayer
     */
    function deployAndSetupSystem(
        address aiValidator,
        address[] calldata relayers,
        address stabilizer,
        uint256 initialRelayerFunding
    ) external payable onlyOwner {
        // Deploy the system
        deployCompleteSystem();
        
        // Setup initial configuration
        setupInitialConfiguration(aiValidator, address(0), stabilizer);
        
        // Add multiple relayers
        addMultipleRelayers(relayers);
        
        // Fund relayers if funding provided
        if (initialRelayerFunding > 0 && msg.value > 0) {
            fundMultipleRelayers(relayers, initialRelayerFunding);
        }
        
        // Send remaining funds to merkle distributor for distributions
        if (address(this).balance > 0) {
            payable(address(merkleDistributor)).transfer(address(this).balance);
        }
    }
    
    /**
     * @dev Update daily limits for all interaction types
     * @param userLimits Array of user limits per interaction type
     * @param qobiCaps Array of QOBI caps per interaction type
     */
    function updateAllDailyLimits(
        uint256[6] calldata userLimits,
        uint256[6] calldata qobiCaps
    ) external onlyOwner {
        require(address(treeGenerator) != address(0), "QOBISystemDeployer: System not deployed");
        
        for (uint8 i = 0; i < 6; i++) {
            treeGenerator.updateDailyLimits(i, userLimits[i], qobiCaps[i]);
        }
        
        // Also update distributor caps
        merkleDistributor.updateDailyQOBICaps(qobiCaps);
    }
    
    /**
     * @dev Get all deployed contract addresses
     * @return _accessControl Access control contract address
     * @return _stabilizing Stabilizing contract address
     * @return _treeGenerator Tree generator contract address
     * @return _merkleDistributor Merkle distributor contract address
     * @return _relayerTreasury Relayer treasury contract address
     */
    function getDeployedContracts() external view returns (
        address _accessControl,
        address _stabilizing,
        address _treeGenerator,
        address _merkleDistributor,
        address _relayerTreasury
    ) {
        return (
            address(accessControl),
            address(stabilizingContract),
            address(treeGenerator),
            address(merkleDistributor),
            address(relayerTreasury)
        );
    }
    
    /**
     * @dev Check if system is fully deployed
     * @return True if all contracts are deployed
     */
    function isSystemDeployed() external view returns (bool) {
        return address(accessControl) != address(0) &&
               address(stabilizingContract) != address(0) &&
               address(treeGenerator) != address(0) &&
               address(merkleDistributor) != address(0) &&
               address(relayerTreasury) != address(0);
    }
    
    /**
     * @dev Emergency function to transfer ownership of all contracts
     * @param newOwner Address of the new owner
     */
    function transferSystemOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "QOBISystemDeployer: Invalid address");
        
        if (address(accessControl) != address(0)) {
            accessControl.transferOwnership(newOwner);
        }
        if (address(stabilizingContract) != address(0)) {
            stabilizingContract.transferOwnership(newOwner);
        }
        if (address(treeGenerator) != address(0)) {
            treeGenerator.transferOwnership(newOwner);
        }
        if (address(merkleDistributor) != address(0)) {
            merkleDistributor.transferOwnership(newOwner);
        }
        if (address(relayerTreasury) != address(0)) {
            relayerTreasury.transferOwnership(newOwner);
        }
    }
    
    /**
     * @dev Emergency withdraw any funds from this contract
     */
    function emergencyWithdraw() external onlyOwner {
        if (address(this).balance > 0) {
            payable(owner()).transfer(address(this).balance);
        }
    }
    
    // Receive funds for deployment and initial funding
    receive() external payable {}
}
