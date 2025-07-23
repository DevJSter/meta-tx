// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
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
        contractDeploymentDay = getCurrentDay();

        // Mint initial supply to owner for liquidity/partnerships
        _mint(msg.sender, 1000000e18); // 1M tokens
    }

    function getCurrentDay() public view returns (uint256) {
        return (block.timestamp - (contractDeploymentDay * SECONDS_PER_DAY)) / SECONDS_PER_DAY + contractDeploymentDay;
    }

    function setMetaTxContract(address _metaTxContract) external onlyOwner {
        address oldContract = metaTxContract;
        metaTxContract = _metaTxContract;
        authorizedContracts[_metaTxContract] = true;
        emit MetaTxContractUpdated(oldContract, _metaTxContract);
    }

    function setAuthorizedContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
    }

    function updateRewardParameters(uint256 _baseRewardPerPoint, uint256 _maxDailyMint, uint256 _minPointsThreshold)
        external
        onlyOwner
    {
        require(_baseRewardPerPoint > 0, "Invalid base reward");
        require(_maxDailyMint > 0, "Invalid max daily mint");
        require(_minPointsThreshold > 0, "Invalid min threshold");

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

        uint256 currentDay = getCurrentDay();
        UserRewards storage rewards = userRewards[user];

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

        // Calculate base reward
        uint256 baseReward = (rewards.dailyPoints * baseRewardPerPoint) / POINTS_DECIMALS;

        // Apply streak bonus
        uint256 streakBonus = _calculateStreakBonus(user, currentDay);
        uint256 totalReward = (baseReward * streakBonus) / 100;

        // Cap at max daily mint
        if (totalReward > maxDailyMint) {
            totalReward = maxDailyMint;
        }

        // Update user state
        rewards.dayMinted[currentDay] = true;
        rewards.lastMintDay = currentDay;
        rewards.totalMinted += totalReward;
        rewards.dailyPoints = 0; // Reset daily points after minting

        // Update streak
        if (currentDay == rewards.lastMintDay + 1 || rewards.lastMintDay == 0) {
            rewards.streakDays++;
        } else {
            rewards.streakDays = 1; // Reset streak
        }

        // Mint tokens (users pay their own gas)
        _mint(user, totalReward);

        emit TokensMinted(user, totalReward, currentDay);
    }

    function _calculateStreakBonus(address user, uint256 currentDay) internal view returns (uint256) {
        UserRewards storage rewards = userRewards[user];

        // Check for consecutive days
        uint256 consecutiveDays = 0;
        for (uint256 i = 1; i <= 7 && currentDay >= i; i++) {
            // Check last 7 days
            uint256 checkDay = currentDay - i;
            if (rewards.dayMinted[checkDay]) {
                consecutiveDays++;
            } else {
                break;
            }
        }

        // Calculate bonus: 10% per consecutive day, max 50%
        uint256 bonusPercentage = consecutiveDays * 10;
        if (bonusPercentage > 50) {
            bonusPercentage = 50;
        }

        return 100 + bonusPercentage; // Base 100% + bonus
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
}
