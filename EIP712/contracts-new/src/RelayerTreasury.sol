// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./QOBIAccessControl.sol";

/**
 * @title RelayerTreasury
 * @dev Manages relayer funding and gas reimbursement tracking
 */
contract RelayerTreasury is Ownable {
    QOBIAccessControl public accessControl;
    address public stabilizingContract;
    
    struct RelayerInfo {
        bool authorized;
        uint256 balance;
        uint256 totalGasUsed;
        uint256 lastActivity;
        uint256 totalReimbursed;
    }
    
    mapping(address => RelayerInfo) public relayers;
    address[] public relayerList;
    
    uint256 public totalFunded;
    uint256 public totalGasReimbursed;
    uint256 public minRelayerBalance = 0.1 ether; // Minimum balance threshold
    
    event RelayerFunded(address indexed relayer, uint256 amount);
    event GasReimbursed(address indexed relayer, uint256 gasUsed, uint256 gasCost);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event StabilizingContractUpdated(address indexed newContract);
    event MinRelayerBalanceUpdated(uint256 newMinBalance);
    
    constructor(address _accessControl) Ownable(msg.sender) {
        accessControl = QOBIAccessControl(_accessControl);
    }
    
    modifier onlyRelayer() {
        require(
            accessControl.hasRole(keccak256("RELAYER_ROLE"), msg.sender),
            "RelayerTreasury: Not authorized relayer"
        );
        require(relayers[msg.sender].authorized, "RelayerTreasury: Relayer not active");
        _;
    }
    
    /**
     * @dev Set the stabilizing contract address
     * @param _stabilizing Address of the stabilizing contract
     */
    function setStabilizingContract(address _stabilizing) external onlyOwner {
        require(_stabilizing != address(0), "RelayerTreasury: Invalid address");
        stabilizingContract = _stabilizing;
        emit StabilizingContractUpdated(_stabilizing);
    }
    
    /**
     * @dev Add a new relayer to the system
     * @param relayer Address of the relayer to add
     */
    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "RelayerTreasury: Invalid address");
        require(!relayers[relayer].authorized, "RelayerTreasury: Relayer already exists");
        
        relayers[relayer] = RelayerInfo({
            authorized: true,
            balance: 0,
            totalGasUsed: 0,
            lastActivity: block.timestamp,
            totalReimbursed: 0
        });
        
        relayerList.push(relayer);
        emit RelayerAdded(relayer);
    }
    
    /**
     * @dev Remove a relayer from the system
     * @param relayer Address of the relayer to remove
     */
    function removeRelayer(address relayer) external onlyOwner {
        require(relayers[relayer].authorized, "RelayerTreasury: Relayer not found");
        
        // Return remaining balance to the relayer
        uint256 remainingBalance = relayers[relayer].balance;
        if (remainingBalance > 0) {
            require(address(this).balance >= remainingBalance, "RelayerTreasury: Insufficient contract balance");
            relayers[relayer].balance = 0;
        }
        
        relayers[relayer].authorized = false;
        
        // Remove from relayer list
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayerList[i] == relayer) {
                relayerList[i] = relayerList[relayerList.length - 1];
                relayerList.pop();
                break;
            }
        }
        
        // Transfer after state changes (checks-effects-interactions pattern)
        if (remainingBalance > 0) {
            payable(relayer).transfer(remainingBalance);
        }
        
        emit RelayerRemoved(relayer);
    }
    
    /**
     * @dev Fund a specific relayer
     * @param relayer Address of the relayer to fund
     * @param amount Amount to fund
     */
    function fundRelayer(address relayer, uint256 amount) external onlyOwner {
        require(relayers[relayer].authorized, "RelayerTreasury: Relayer not authorized");
        require(amount > 0, "RelayerTreasury: Invalid amount");
        require(address(this).balance >= amount, "RelayerTreasury: Insufficient treasury balance");
        
        relayers[relayer].balance += amount;
        totalFunded += amount;
        
        payable(relayer).transfer(amount);
        emit RelayerFunded(relayer, amount);
    }
    
    /**
     * @dev Record gas usage by a relayer (called by relayer after transaction)
     * @param gasUsed Amount of gas used
     * @param gasPrice Gas price used for the transaction
     */
    function recordGasUsage(uint256 gasUsed, uint256 gasPrice) external onlyRelayer {
        RelayerInfo storage relayer = relayers[msg.sender];
        
        uint256 gasCost = gasUsed * gasPrice;
        require(relayer.balance >= gasCost, "RelayerTreasury: Insufficient relayer balance");
        
        // Update relayer stats
        relayer.balance -= gasCost;
        relayer.totalGasUsed += gasUsed;
        relayer.totalReimbursed += gasCost;
        relayer.lastActivity = block.timestamp;
        totalGasReimbursed += gasCost;
        
        // Record burn for stabilizing mechanism
        if (stabilizingContract != address(0)) {
            // Call the stabilizing contract to record the burn
            (bool success, ) = stabilizingContract.call(
                abi.encodeWithSignature("recordGasBurn(uint256)", gasCost)
            );
            require(success, "RelayerTreasury: Failed to record gas burn");
        }
        
        emit GasReimbursed(msg.sender, gasUsed, gasCost);
    }
    
    /**
     * @dev Batch fund multiple relayers
     * @param relayerAddresses Array of relayer addresses
     * @param amounts Array of amounts to fund each relayer
     */
    function batchFundRelayers(
        address[] calldata relayerAddresses,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(
            relayerAddresses.length == amounts.length,
            "RelayerTreasury: Array length mismatch"
        );
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(
            address(this).balance >= totalAmount,
            "RelayerTreasury: Insufficient treasury balance"
        );
        
        // Update all state first, then make transfers
        address[] memory validRelayers = new address[](relayerAddresses.length);
        uint256[] memory validAmounts = new uint256[](relayerAddresses.length);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < relayerAddresses.length; i++) {
            address relayer = relayerAddresses[i];
            uint256 amount = amounts[i];
            
            if (relayers[relayer].authorized && amount > 0) {
                relayers[relayer].balance += amount;
                totalFunded += amount;
                validRelayers[validCount] = relayer;
                validAmounts[validCount] = amount;
                validCount++;
            }
        }
        
        // Now make all transfers
        for (uint256 i = 0; i < validCount; i++) {
            payable(validRelayers[i]).transfer(validAmounts[i]);
            emit RelayerFunded(validRelayers[i], validAmounts[i]);
        }
    }
    
    /**
     * @dev Update minimum relayer balance threshold
     * @param newMinBalance New minimum balance
     */
    function updateMinRelayerBalance(uint256 newMinBalance) external onlyOwner {
        minRelayerBalance = newMinBalance;
        emit MinRelayerBalanceUpdated(newMinBalance);
    }
    
    /**
     * @dev Get relayer information
     * @param relayer Address of the relayer
     * @return authorized Whether the relayer is authorized
     * @return balance Current balance of the relayer
     * @return totalGasUsed Total gas used by the relayer
     * @return lastActivity Last activity timestamp
     * @return totalReimbursed Total amount reimbursed to relayer
     */
    function getRelayerInfo(address relayer) external view returns (
        bool authorized,
        uint256 balance,
        uint256 totalGasUsed,
        uint256 lastActivity,
        uint256 totalReimbursed
    ) {
        RelayerInfo storage info = relayers[relayer];
        return (
            info.authorized,
            info.balance,
            info.totalGasUsed,
            info.lastActivity,
            info.totalReimbursed
        );
    }
    
    /**
     * @dev Get all authorized relayers
     * @return Array of authorized relayer addresses
     */
    function getAllRelayers() external view returns (address[] memory) {
        return relayerList;
    }
    
    /**
     * @dev Get count of authorized relayers
     * @return Number of authorized relayers
     */
    function getRelayerCount() external view returns (uint256) {
        return relayerList.length;
    }
    
    /**
     * @dev Get relayers with low balance (below minimum threshold)
     * @return lowBalanceRelayers Array of relayers with low balance
     */
    function getLowBalanceRelayers() external view returns (address[] memory lowBalanceRelayers) {
        uint256 count = 0;
        
        // First pass: count low balance relayers
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayers[relayerList[i]].authorized && 
                relayers[relayerList[i]].balance < minRelayerBalance) {
                count++;
            }
        }
        
        // Second pass: populate array
        lowBalanceRelayers = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayers[relayerList[i]].authorized && 
                relayers[relayerList[i]].balance < minRelayerBalance) {
                lowBalanceRelayers[index] = relayerList[i];
                index++;
            }
        }
    }
    
    /**
     * @dev Get treasury statistics
     * @return totalBalance Current treasury balance
     * @return _totalFunded Total amount funded to relayers
     * @return _totalGasReimbursed Total gas reimbursed
     * @return activeRelayers Number of active relayers
     */
    function getTreasuryStats() external view returns (
        uint256 totalBalance,
        uint256 _totalFunded,
        uint256 _totalGasReimbursed,
        uint256 activeRelayers
    ) {
        uint256 active = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayers[relayerList[i]].authorized) {
                active++;
            }
        }
        
        return (
            address(this).balance,
            totalFunded,
            totalGasReimbursed,
            active
        );
    }
    
    /**
     * @dev Emergency withdraw funds (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "RelayerTreasury: Insufficient balance");
        payable(owner()).transfer(amount);
    }
    
    // Receive native QOBI tokens
    receive() external payable {}
    fallback() external payable {}
}
