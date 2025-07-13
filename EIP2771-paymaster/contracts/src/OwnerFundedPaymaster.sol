// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IEIP2771Forwarder.sol";
import "./EIP2771Forwarder.sol";

/**
 * @title OwnerFundedPaymaster
 * @dev Owner-funded paymaster that sponsors transactions for whitelisted contracts
 * The owner deposits ETH and the paymaster uses it to pay for gas
 */
contract OwnerFundedPaymaster is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    EIP2771Forwarder public immutable forwarder;
    
    mapping(address => bool) public sponsoredContracts;
    mapping(address => uint256) public userCredits; // Optional user contributions
    
    uint256 public baseFee = 21000;
    uint256 public feeMultiplier = 120; // 120% of actual gas cost
    uint256 public maxGasLimit = 500000;
    uint256 public maxTransactionCost = 0.01 ether; // Max cost per transaction
    
    bool public ownerFunded = true; // Owner pays for sponsored contracts
    bool public allowUserContributions = false; // Allow users to also contribute
    
    event TransactionSponsored(
        address indexed user,
        address indexed target,
        uint256 gasUsed,
        uint256 fee,
        bool paidByOwner
    );
    
    event ContractSponsored(address indexed contractAddress, bool sponsored);
    event OwnerDeposited(uint256 amount);
    event OwnerFundingToggled(bool enabled);
    event UserContributionsToggled(bool enabled);
    event CreditDeposited(address indexed user, uint256 amount);
    event CreditWithdrawn(address indexed user, uint256 amount);
    
    modifier onlyForwarder() {
        require(msg.sender == address(forwarder), "Paymaster: caller is not the forwarder");
        _;
    }
    
    constructor(address _forwarder, address initialOwner) Ownable(initialOwner) {
        forwarder = EIP2771Forwarder(_forwarder);
    }
    
    /**
     * @dev Owner deposits ETH to fund gas payments
     */
    function ownerDeposit() external payable onlyOwner {
        require(msg.value > 0, "Paymaster: deposit amount must be greater than 0");
        emit OwnerDeposited(msg.value);
    }
    
    /**
     * @dev Add or remove a contract from sponsorship
     */
    function setSponsoredContract(address contractAddress, bool sponsored) external onlyOwner {
        sponsoredContracts[contractAddress] = sponsored;
        emit ContractSponsored(contractAddress, sponsored);
    }
    
    /**
     * @dev Toggle owner funding mode
     */
    function setOwnerFunded(bool _ownerFunded) external onlyOwner {
        ownerFunded = _ownerFunded;
        emit OwnerFundingToggled(_ownerFunded);
    }
    
    /**
     * @dev Toggle user contributions
     */
    function setUserContributions(bool _allowUserContributions) external onlyOwner {
        allowUserContributions = _allowUserContributions;
        emit UserContributionsToggled(_allowUserContributions);
    }
    
    /**
     * @dev Set fee parameters
     */
    function setFeeParameters(uint256 _baseFee, uint256 _feeMultiplier, uint256 _maxGasLimit) external onlyOwner {
        baseFee = _baseFee;
        feeMultiplier = _feeMultiplier;
        maxGasLimit = _maxGasLimit;
    }
    
    /**
     * @dev Set maximum transaction cost
     */
    function setMaxTransactionCost(uint256 _maxTransactionCost) external onlyOwner {
        maxTransactionCost = _maxTransactionCost;
    }
    
    /**
     * @dev Users can deposit credits (if enabled)
     */
    function depositCredits(address user) external payable {
        require(allowUserContributions, "Paymaster: user contributions disabled");
        require(msg.value > 0, "Paymaster: deposit amount must be greater than 0");
        userCredits[user] += msg.value;
        emit CreditDeposited(user, msg.value);
    }
    
    /**
     * @dev Users can withdraw their credits
     */
    function withdrawCredits(uint256 amount) external {
        require(userCredits[msg.sender] >= amount, "Paymaster: insufficient credits");
        userCredits[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit CreditWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Check if transaction can be afforded (by owner or user)
     */
    function canAffordTransaction(address user, uint256 gasLimit) external view returns (bool) {
        uint256 estimatedFee = getEstimatedFee(gasLimit);
        
        if (estimatedFee > maxTransactionCost) {
            return false;
        }
        
        if (ownerFunded && address(this).balance >= estimatedFee) {
            return true;
        }
        
        if (allowUserContributions && userCredits[user] >= estimatedFee) {
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Sponsor a transaction (called by anyone, paymaster pays if conditions met)
     */
    function sponsorTransaction(
        IEIP2771Forwarder.ForwardRequest calldata req,
        bytes calldata signature
    ) external nonReentrant returns (bool success, bytes memory returndata) {
        require(sponsoredContracts[req.to], "Paymaster: contract not sponsored");
        require(req.gas <= maxGasLimit, "Paymaster: gas limit too high");
        
        uint256 estimatedFee = getEstimatedFee(req.gas);
        require(estimatedFee <= maxTransactionCost, "Paymaster: transaction cost too high");
        
        bool paidByOwner = false;
        
        // Try to pay with owner funds first
        if (ownerFunded && address(this).balance >= estimatedFee) {
            paidByOwner = true;
        } else if (allowUserContributions && userCredits[req.from] >= estimatedFee) {
            userCredits[req.from] -= estimatedFee;
            paidByOwner = false;
        } else {
            revert("Paymaster: insufficient funds");
        }
        
        // Execute the transaction through forwarder
        (success, returndata) = forwarder.executeWithPaymaster(req, signature);
        
        emit TransactionSponsored(req.from, req.to, req.gas, estimatedFee, paidByOwner);
    }
    
    /**
     * @dev Check if paymaster can sponsor a transaction (called by forwarder)
     */
    function canSponsorTransaction(address user, address target, uint256 gasLimit) 
        external 
        view 
        returns (bool) 
    {
        if (!sponsoredContracts[target]) return false;
        if (gasLimit > maxGasLimit) return false;
        
        uint256 estimatedFee = getEstimatedFee(gasLimit);
        
        if (ownerFunded) {
            // Check if contract has enough balance
            return address(this).balance >= estimatedFee;
        } else {
            // Check if user has enough credits
            return userCredits[user] >= estimatedFee;
        }
    }
    
    /**
     * @dev Pay for a transaction (called by forwarder after execution)
     */
    function processPayment(address user, address target, uint256 gasUsed, uint256 gasPrice) 
        public 
        onlyForwarder 
    {
        require(sponsoredContracts[target], "Paymaster: contract not sponsored");
        
        uint256 fee = (gasUsed * (gasPrice > 0 ? gasPrice : 1 gwei) * feeMultiplier) / 100;
        
        if (ownerFunded) {
            // Owner pays - deduct from contract balance
            require(address(this).balance >= fee, "Paymaster: insufficient owner funds");
            // Fee is paid from contract balance automatically
        } else {
            // User pays - deduct from user credits
            require(userCredits[user] >= fee, "Paymaster: insufficient user credits");
            userCredits[user] -= fee;
        }
        
        emit TransactionSponsored(user, target, gasUsed, fee, ownerFunded);
    }

    /**
     * @dev Pay for a transaction (legacy method name for backward compatibility)
     */
    function payForTransaction(address user, address target, uint256 gasUsed, uint256 gasPrice) 
        external 
        onlyForwarder 
    {
        processPayment(user, target, gasUsed, gasPrice);
    }

    /**
     * @dev Get estimated fee for a transaction
     */
    function getEstimatedFee(uint256 gasLimit) public view returns (uint256) {
        uint256 gasPrice = tx.gasprice > 0 ? tx.gasprice : 1 gwei; // Use 1 gwei minimum for testing
        return (gasLimit * gasPrice * feeMultiplier) / 100;
    }
    
    /**
     * @dev Emergency withdrawal function for owner
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {
        // Allow direct ETH deposits from owner or anyone
    }
    
    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
