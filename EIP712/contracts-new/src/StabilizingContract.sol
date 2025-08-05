// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./QOBIAccessControl.sol";

/**
 * @title StabilizingContract
 * @dev Manages gas burn tracking and token reminting for supply stabilization
 */
contract StabilizingContract is Ownable {
    QOBIAccessControl public accessControl;
    address public merkleDistributor;
    
    uint256 public totalGasBurned;
    uint256 public lastMintTimestamp;
    uint256 public mintInterval = 1 days;
    
    mapping(uint256 => uint256) public dailyBurnedAmount;
    mapping(address => bool) public authorizedRelayers;
    
    event GasBurnRecorded(address indexed relayer, uint256 amount, uint256 day);
    event TokensReminted(uint256 amount, uint256 day);
    event RelayerAuthorized(address indexed relayer);
    event RelayerDeauthorized(address indexed relayer);
    event MerkleDistributorUpdated(address indexed newDistributor);
    
    constructor(address _accessControl) Ownable(msg.sender) {
        accessControl = QOBIAccessControl(_accessControl);
        lastMintTimestamp = block.timestamp;
    }
    
    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "StabilizingContract: Not authorized relayer");
        _;
    }
    
    modifier onlyStabilizer() {
        require(
            accessControl.hasRole(keccak256("STABILIZER_ROLE"), msg.sender),
            "StabilizingContract: Not stabilizer"
        );
        _;
    }
    
    /**
     * @dev Set the merkle distributor contract address
     * @param _distributor Address of the merkle distributor
     */
    function setMerkleDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "StabilizingContract: Invalid address");
        merkleDistributor = _distributor;
        emit MerkleDistributorUpdated(_distributor);
    }
    
    /**
     * @dev Authorize a relayer to record gas burns
     * @param relayer Address of the relayer to authorize
     */
    function authorizeRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "StabilizingContract: Invalid address");
        authorizedRelayers[relayer] = true;
        emit RelayerAuthorized(relayer);
    }
    
    /**
     * @dev Deauthorize a relayer
     * @param relayer Address of the relayer to deauthorize
     */
    function deauthorizeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerDeauthorized(relayer);
    }
    
    /**
     * @dev Record gas burned by a relayer
     * @param amount Amount of gas burned (in wei equivalent)
     */
    function recordGasBurn(uint256 amount) external onlyAuthorizedRelayer {
        require(amount > 0, "StabilizingContract: Invalid amount");
        
        uint256 today = block.timestamp / 1 days;
        dailyBurnedAmount[today] += amount;
        totalGasBurned += amount;
        
        emit GasBurnRecorded(msg.sender, amount, today);
    }
    
    /**
     * @dev Remint tokens based on burned amount from previous day
     * Can only be called once per day by authorized stabilizer
     */
    function remintBurnedTokens() external onlyStabilizer {
        require(
            block.timestamp >= lastMintTimestamp + mintInterval,
            "StabilizingContract: Too early to mint"
        );
        
        uint256 yesterday = (block.timestamp / 1 days) - 1;
        uint256 burnedAmount = dailyBurnedAmount[yesterday];
        
        if (burnedAmount > 0) {
            require(
                merkleDistributor != address(0),
                "StabilizingContract: Distributor not set"
            );
            
            // Send reminted tokens to distributor
            require(
                address(this).balance >= burnedAmount,
                "StabilizingContract: Insufficient balance"
            );
            
            // Update state before external call (checks-effects-interactions pattern)
            lastMintTimestamp = block.timestamp;
            payable(merkleDistributor).transfer(burnedAmount);
            
            emit TokensReminted(burnedAmount, yesterday);
        }
    }
    
    /**
     * @dev Get burned amount for a specific day
     * @param day Day timestamp (block.timestamp / 1 days)
     * @return Burned amount for that day
     */
    function getBurnedAmount(uint256 day) external view returns (uint256) {
        return dailyBurnedAmount[day];
    }
    
    /**
     * @dev Get current day timestamp
     * @return Current day as timestamp / 1 days
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / 1 days;
    }
    
    /**
     * @dev Update mint interval (only owner)
     * @param newInterval New interval in seconds
     */
    function updateMintInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 1 hours, "StabilizingContract: Interval too short");
        mintInterval = newInterval;
    }
    
    /**
     * @dev Get contract balance
     * @return Current contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "StabilizingContract: Insufficient balance");
        payable(owner()).transfer(amount);
    }
    
    // Receive native QOBI tokens
    receive() external payable {}
    fallback() external payable {}
}
