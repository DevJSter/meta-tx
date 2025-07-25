// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title QobitToken
 * @dev ERC20 token that rewards users for AI-validated social interactions
 * Users earn tokens based on their interaction significance and can mint them daily
 */
contract QobitToken is ERC20, Ownable, ReentrancyGuard {
    // Events
    event InteractionRecorded(address indexed user, string interaction, uint256 significance, uint256 pointsEarned);
    event TokensMinted(address indexed user, uint256 amount, uint256 day);
    event LeaderboardUpdated(address indexed user, uint256 newScore, uint256 rank);
    event RewardParametersUpdated(uint256 newBaseReward, uint256 newMaxDailyMint, uint256 newMinPointsThreshold);
    event MetaTxContractUpdated(address indexed oldContract, address indexed newContract);

    // Structs
    struct UserRewards {
        uint256 totalPoints;
        uint256 lastMintDay;
        uint256 dailyPoints;
        uint256 totalMinted;
        uint256 streakDays;
        mapping(uint256 => uint256) dailyPointsHistory;
        mapping(uint256 => bool) dayMinted;
    }

    struct LeaderboardEntry {
        address user;
        uint256 points;
    }

    // Constants
    uint256 public constant POINTS_DECIMALS = 100; // For 2 decimal precision
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant MAX_LEADERBOARD_SIZE = 100;
    uint256 public constant STREAK_BONUS_MULTIPLIER = 110; // 10% bonus per streak day (max 5 days)
    uint256 public constant MAX_STREAK_BONUS = 150; // 50% max bonus

    // State variables
    mapping(address => UserRewards) public userRewards;
    mapping(address => bool) public authorizedContracts;

    // Reward parameters (adjustable by owner)
    uint256 public baseRewardPerPoint = 1e15; // 0.001 tokens per point (scaled by 1e18)
    uint256 public maxDailyMint = 100e18; // Maximum 100 tokens per day per user
    uint256 public minPointsThreshold = 100; // Minimum 1.00 points to mint (scaled by 100)

    // Leaderboard
    LeaderboardEntry[] public leaderboard;
    mapping(address => uint256) public leaderboardIndex;

    // Contract references
    address public metaTxContract;
    uint256 public contractDeploymentDay;

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() ERC20("Qobit Token", "QBIT") Ownable(msg.sender) {
        // Fix: Initialize contractDeploymentDay with current timestamp
        contractDeploymentDay = block.timestamp / SECONDS_PER_DAY;

        // Mint initial supply to owner for liquidity/partnerships
        _mint(msg.sender, 1000000e18); // 1M tokens
    }

    function getCurrentDay() public view returns (uint256) {
        return block.timestamp / SECONDS_PER_DAY;
    }

    function setMetaTxContract(address _metaTxContract) external onlyOwner {
        require(_metaTxContract != address(0), "Invalid contract address");
        address oldContract = metaTxContract;
        metaTxContract = _metaTxContract;
        authorizedContracts[_metaTxContract] = true;
        emit MetaTxContractUpdated(oldContract, _metaTxContract);
    }

    function setAuthorizedContract(address _contract, bool _authorized) external onlyOwner {
        require(_contract != address(0), "Invalid contract address");
        authorizedContracts[_contract] = _authorized;
    }

    function updateRewardParameters(uint256 _baseRewardPerPoint, uint256 _maxDailyMint, uint256 _minPointsThreshold)
        external
        onlyOwner
    {
        require(_baseRewardPerPoint > 0, "Invalid base reward");
        require(_maxDailyMint > 0, "Invalid max daily mint");
        require(_minPointsThreshold > 0, "Invalid min threshold");
        require(_baseRewardPerPoint <= 1e18, "Base reward too high"); // Max 1 token per point
        require(_maxDailyMint <= 10000e18, "Max daily mint too high"); // Max 10K tokens per day
        require(_minPointsThreshold <= 10000, "Min threshold too high"); // Max 100 points threshold

        baseRewardPerPoint = _baseRewardPerPoint;
        maxDailyMint = _maxDailyMint;
        minPointsThreshold = _minPointsThreshold;

        emit RewardParametersUpdated(_baseRewardPerPoint, _maxDailyMint, _minPointsThreshold);
    }

    /**
     * @dev Called by MetaTx contract when user performs validated interaction
     */
    function recordInteraction(address user, string calldata interaction, uint256 significance)
        external
        onlyAuthorized
    {
        require(user != address(0), "Invalid user");
        require(significance > 0, "Invalid significance");
        require(significance <= 1000 * POINTS_DECIMALS, "Significance too high"); // Max 1000 points per interaction

        uint256 currentDay = getCurrentDay();
        UserRewards storage rewards = userRewards[user];

        // Check for daily points overflow
        require(rewards.dailyPoints + significance >= rewards.dailyPoints, "Daily points overflow");
        require(rewards.totalPoints + significance >= rewards.totalPoints, "Total points overflow");

        // Add points to daily and total counters
        rewards.dailyPoints += significance;
        rewards.totalPoints += significance;
        rewards.dailyPointsHistory[currentDay] += significance;

        // Update leaderboard
        _updateLeaderboard(user, rewards.totalPoints);

        emit InteractionRecorded(user, interaction, significance, significance);
    }

    /**
     * @dev Mint daily reward tokens based on accumulated points
     * Users can only mint once per day and must meet minimum threshold
     */
    function mintDailyReward() external nonReentrant {
        address user = msg.sender;
        uint256 currentDay = getCurrentDay();
        UserRewards storage rewards = userRewards[user];

        require(!rewards.dayMinted[currentDay], "Already minted today");
        require(rewards.dailyPoints >= minPointsThreshold, "Insufficient daily points");

        // Calculate streak BEFORE updating lastMintDay
        uint256 streakBonus = _calculateStreakBonus(user, currentDay);

        // Calculate base reward
        uint256 baseReward = (rewards.dailyPoints * baseRewardPerPoint) / POINTS_DECIMALS;

        // Apply streak bonus
        uint256 totalReward = (baseReward * streakBonus) / 100;

        // Cap at max daily mint
        if (totalReward > maxDailyMint) {
            totalReward = maxDailyMint;
        }

        // Ensure we don't mint zero tokens
        require(totalReward > 0, "No tokens to mint");

        // Update streak logic - check if consecutive minting
        if (rewards.lastMintDay == 0) {
            // First time minting
            rewards.streakDays = 1;
        } else if (currentDay == rewards.lastMintDay + 1) {
            // Consecutive day minting
            rewards.streakDays++;
            if (rewards.streakDays > 5) {
                rewards.streakDays = 5; // Cap at 5 days for max bonus
            }
        } else {
            // Non-consecutive - reset streak
            rewards.streakDays = 1;
        }

        // Update user state
        rewards.dayMinted[currentDay] = true;
        rewards.lastMintDay = currentDay;
        rewards.totalMinted += totalReward;
        rewards.dailyPoints = 0; // Reset daily points after minting

        // Mint tokens (users pay their own gas)
        _mint(user, totalReward);

        emit TokensMinted(user, totalReward, currentDay);
    }

    function _calculateStreakBonus(address user, uint256 currentDay) internal view returns (uint256) {
        UserRewards storage rewards = userRewards[user];

        // If this is the first mint or no previous mint day recorded
        if (rewards.lastMintDay == 0) {
            return 100; // Base 100% (no bonus)
        }

        // Check if user minted yesterday for streak continuation
        if (currentDay == rewards.lastMintDay + 1) {
            // User has consecutive streak, apply bonus based on current streak
            // For streak day 1: 10% bonus (110%), day 2: 20% bonus (120%), etc.
            uint256 bonusPercentage = rewards.streakDays * 10; // 10% per streak day
            uint256 maxBonus = 50; // 50% max bonus

            if (bonusPercentage > maxBonus) {
                bonusPercentage = maxBonus;
            }

            return 100 + bonusPercentage; // Base 100% + bonus
        }

        // Non-consecutive minting, no streak bonus
        return 100;
    }

    function _updateLeaderboard(address user, uint256 newScore) internal {
        uint256 currentIndex = leaderboardIndex[user];

        if (currentIndex == 0) {
            // New user - add to leaderboard if there's space or they beat the lowest score
            if (leaderboard.length < MAX_LEADERBOARD_SIZE) {
                leaderboard.push(LeaderboardEntry(user, newScore));
                leaderboardIndex[user] = leaderboard.length;
                _bubbleUp(leaderboard.length - 1);
            } else if (newScore > leaderboard[MAX_LEADERBOARD_SIZE - 1].points) {
                // Replace lowest score
                address removedUser = leaderboard[MAX_LEADERBOARD_SIZE - 1].user;
                leaderboardIndex[removedUser] = 0;

                leaderboard[MAX_LEADERBOARD_SIZE - 1] = LeaderboardEntry(user, newScore);
                leaderboardIndex[user] = MAX_LEADERBOARD_SIZE;
                _bubbleUp(MAX_LEADERBOARD_SIZE - 1);
            }
        } else {
            // Existing user - update score and reposition
            leaderboard[currentIndex - 1].points = newScore;
            _bubbleUp(currentIndex - 1);
        }

        emit LeaderboardUpdated(user, newScore, leaderboardIndex[user]);
    }

    function _bubbleUp(uint256 index) internal {
        while (index > 0) {
            uint256 parentIndex = index - 1;
            if (leaderboard[index].points <= leaderboard[parentIndex].points) {
                break;
            }

            // Swap
            LeaderboardEntry memory temp = leaderboard[index];
            leaderboard[index] = leaderboard[parentIndex];
            leaderboard[parentIndex] = temp;

            // Update indices
            leaderboardIndex[leaderboard[index].user] = index + 1;
            leaderboardIndex[leaderboard[parentIndex].user] = parentIndex + 1;

            index = parentIndex;
        }
    }

    // View functions
    function getUserRewardInfo(address user)
        external
        view
        returns (
            uint256 totalPoints,
            uint256 dailyPoints,
            uint256 totalMinted,
            uint256 streakDays,
            bool canMintToday,
            uint256 estimatedReward
        )
    {
        uint256 currentDay = getCurrentDay();
        UserRewards storage rewards = userRewards[user];

        canMintToday = !rewards.dayMinted[currentDay] && rewards.dailyPoints >= minPointsThreshold;

        if (canMintToday) {
            uint256 baseReward = (rewards.dailyPoints * baseRewardPerPoint) / POINTS_DECIMALS;
            uint256 streakBonus = _calculateStreakBonus(user, currentDay);
            estimatedReward = (baseReward * streakBonus) / 100;
            if (estimatedReward > maxDailyMint) {
                estimatedReward = maxDailyMint;
            }
        }

        return (
            rewards.totalPoints,
            rewards.dailyPoints,
            rewards.totalMinted,
            rewards.streakDays,
            canMintToday,
            estimatedReward
        );
    }

    function getLeaderboard(uint256 limit) external view returns (LeaderboardEntry[] memory) {
        uint256 returnSize = limit > leaderboard.length ? leaderboard.length : limit;
        LeaderboardEntry[] memory result = new LeaderboardEntry[](returnSize);

        for (uint256 i = 0; i < returnSize; i++) {
            result[i] = leaderboard[i];
        }

        return result;
    }

    function getUserDailyPoints(address user, uint256 day) external view returns (uint256) {
        return userRewards[user].dailyPointsHistory[day];
    }

    function hasUserMintedToday(address user) external view returns (bool) {
        uint256 currentDay = getCurrentDay();
        return userRewards[user].dayMinted[currentDay];
    }

    // Emergency functions
    function emergencyPause() external onlyOwner {
        // Could implement pause functionality here
        // For now, we can disable authorized contracts
        metaTxContract = address(0);
    }
}
