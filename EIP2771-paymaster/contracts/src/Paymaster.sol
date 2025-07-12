// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Forwarder.sol";

/**
 * @title Paymaster
 * @dev Paymaster contract for sponsoring meta-transactions
 */
contract Paymaster is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PaymasterRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        address paymentToken;
        uint256 paymentAmount;
        uint256 deadline;
    }

    MinimalForwarder public immutable forwarder;
    
    mapping(address => bool) public sponsoredContracts;
    mapping(address => bool) public whitelistedTokens;
    mapping(address => uint256) public userCredits;
    mapping(address => mapping(address => uint256)) public tokenBalances;
    
    uint256 public baseFee = 21000; // Base gas fee
    uint256 public feeMultiplier = 120; // 120% of actual gas cost
    uint256 public maxGasLimit = 500000;
    
    event TransactionSponsored(
        address indexed user,
        address indexed target,
        uint256 gasUsed,
        uint256 fee,
        address paymentToken,
        uint256 paymentAmount
    );
    
    event ContractSponsored(address indexed contractAddress, bool sponsored);
    event TokenWhitelisted(address indexed token, bool whitelisted);
    event CreditDeposited(address indexed user, uint256 amount);
    event CreditWithdrawn(address indexed user, uint256 amount);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);
    
    modifier onlyForwarder() {
        require(msg.sender == address(forwarder), "Paymaster: caller is not the forwarder");
        _;
    }
    
    constructor(address _forwarder) {
        forwarder = MinimalForwarder(_forwarder);
    }
    
    /**
     * @dev Add or remove a contract from sponsorship
     */
    function setSponsoredContract(address contractAddress, bool sponsored) external onlyOwner {
        sponsoredContracts[contractAddress] = sponsored;
        emit ContractSponsored(contractAddress, sponsored);
    }
    
    /**
     * @dev Add or remove a token from whitelist
     */
    function setWhitelistedToken(address token, bool whitelisted) external onlyOwner {
        whitelistedTokens[token] = whitelisted;
        emit TokenWhitelisted(token, whitelisted);
    }
    
    /**
     * @dev Set base fee parameters
     */
    function setFeeParameters(uint256 _baseFee, uint256 _feeMultiplier, uint256 _maxGasLimit) external onlyOwner {
        baseFee = _baseFee;
        feeMultiplier = _feeMultiplier;
        maxGasLimit = _maxGasLimit;
    }
    
    /**
     * @dev Deposit ETH credits for a user
     */
    function depositCredits(address user) external payable {
        require(msg.value > 0, "Paymaster: no ETH sent");
        userCredits[user] += msg.value;
        emit CreditDeposited(user, msg.value);
    }
    
    /**
     * @dev Withdraw ETH credits
     */
    function withdrawCredits(uint256 amount) external nonReentrant {
        require(userCredits[msg.sender] >= amount, "Paymaster: insufficient credits");
        userCredits[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit CreditWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Deposit tokens for gas payment
     */
    function depositToken(address token, uint256 amount) external {
        require(whitelistedTokens[token], "Paymaster: token not whitelisted");
        require(amount > 0, "Paymaster: amount must be greater than 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[msg.sender][token] += amount;
        emit TokenDeposited(msg.sender, token, amount);
    }
    
    /**
     * @dev Withdraw tokens
     */
    function withdrawToken(address token, uint256 amount) external nonReentrant {
        require(tokenBalances[msg.sender][token] >= amount, "Paymaster: insufficient token balance");
        tokenBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokenWithdrawn(msg.sender, token, amount);
    }
    
    /**
     * @dev Sponsor a meta-transaction
     */
    function sponsorTransaction(
        MinimalForwarder.ForwardRequest calldata req,
        bytes calldata signature
    ) external nonReentrant returns (bool success, bytes memory returndata) {
        require(sponsoredContracts[req.to], "Paymaster: contract not sponsored");
        require(req.gas <= maxGasLimit, "Paymaster: gas limit too high");
        
        uint256 gasStart = gasleft();
        
        // Execute the transaction through the forwarder
        (success, returndata) = forwarder.executeWithPaymaster(req, signature);
        
        uint256 gasUsed = gasStart - gasleft() + baseFee;
        uint256 fee = (gasUsed * tx.gasprice * feeMultiplier) / 100;
        
        // Deduct from user credits
        require(userCredits[req.from] >= fee, "Paymaster: insufficient credits");
        userCredits[req.from] -= fee;
        
        emit TransactionSponsored(req.from, req.to, gasUsed, fee, address(0), 0);
    }
    
    /**
     * @dev Sponsor a meta-transaction with token payment
     */
    function sponsorTransactionWithToken(
        MinimalForwarder.ForwardRequest calldata req,
        bytes calldata signature,
        address paymentToken,
        uint256 paymentAmount
    ) external nonReentrant returns (bool success, bytes memory returndata) {
        require(sponsoredContracts[req.to], "Paymaster: contract not sponsored");
        require(req.gas <= maxGasLimit, "Paymaster: gas limit too high");
        require(whitelistedTokens[paymentToken], "Paymaster: payment token not whitelisted");
        
        uint256 gasStart = gasleft();
        
        // Execute the transaction through the forwarder
        (success, returndata) = forwarder.executeWithPaymaster(req, signature);
        
        uint256 gasUsed = gasStart - gasleft() + baseFee;
        
        // Deduct from user token balance
        require(tokenBalances[req.from][paymentToken] >= paymentAmount, "Paymaster: insufficient token balance");
        tokenBalances[req.from][paymentToken] -= paymentAmount;
        
        emit TransactionSponsored(req.from, req.to, gasUsed, 0, paymentToken, paymentAmount);
    }
    
    /**
     * @dev Check if a user can afford a transaction
     */
    function canAffordTransaction(address user, uint256 gasLimit) external view returns (bool) {
        uint256 estimatedFee = (gasLimit * tx.gasprice * feeMultiplier) / 100;
        return userCredits[user] >= estimatedFee;
    }
    
    /**
     * @dev Get estimated fee for a transaction
     */
    function getEstimatedFee(uint256 gasLimit) external view returns (uint256) {
        return (gasLimit * tx.gasprice * feeMultiplier) / 100;
    }
    
    /**
     * @dev Emergency withdrawal function for owner
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Emergency token withdrawal function for owner
     */
    function emergencyWithdrawToken(address token) external onlyOwner {
        IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {
        // Accept ETH for gas payments
    }
}
