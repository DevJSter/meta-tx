// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IQobitMinting {
    function recordInteraction(address user, string calldata interaction, uint256 significance) external;
}

contract MetaTxInteraction is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Events
    event InteractionPerformed(
        address indexed user, string interaction, uint256 significance, uint256 indexed nonce, bytes32 indexed txHash
    );
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event MintingContractUpdated(address indexed oldContract, address indexed newContract);
    event InteractionTypeAdded(string interactionType, uint256 basePoints);
    event UserScoreUpdated(address indexed user, uint256 newScore, uint256 totalInteractions);

    // Structs
    struct MetaTx {
        address user;
        string interaction;
        uint256 nonce;
    }

    struct UserStats {
        uint256 totalInteractions;
        uint256 totalSignificancePoints;
        uint256 lastInteractionTime;
        mapping(string => uint256) interactionCounts;
    }

    struct InteractionType {
        uint256 basePoints;
        uint256 cooldownPeriod; // Keep the field for compatibility but set to 0
        bool isActive;
    }

    // Constants
    bytes32 public constant META_TX_TYPEHASH = keccak256("MetaTx(address user,string interaction,uint256 nonce)");
    uint256 public constant MAX_SIGNIFICANCE = 1000; // 10.00 (scaled by 100)
    uint256 public constant MIN_SIGNIFICANCE = 10; // 0.10 (scaled by 100)

    // State variables
    mapping(address => uint256) public nonces;
    mapping(address => UserStats) public userStats;
    mapping(string => InteractionType) public interactionTypes;
    mapping(address => mapping(string => uint256)) public lastInteractionTime; // Keep for compatibility

    bytes32 public DOMAIN_SEPARATOR;
    address public authorizedRelayer;
    IQobitMinting public mintingContract;

    // Modifiers
    modifier onlyRelayer() {
        require(msg.sender == authorizedRelayer, "Only authorized relayer");
        _;
    }

    constructor() Ownable(msg.sender) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("QoneqtMetaTx")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );

        // Initialize common interaction types with NO COOLDOWNS (cooldownPeriod = 0)
        _addInteractionType("like_post", 10, 0); // No cooldown
        _addInteractionType("comment_post", 25, 0); // No cooldown
        _addInteractionType("share_post", 50, 0); // No cooldown
        _addInteractionType("create_post", 100, 0); // No cooldown
        _addInteractionType("follow_user", 30, 0); // No cooldown
        _addInteractionType("join_community", 75, 0); // No cooldown
    }

    function setAuthorizedRelayer(address _relayer) external onlyOwner {
        address oldRelayer = authorizedRelayer;
        authorizedRelayer = _relayer;
        emit RelayerUpdated(oldRelayer, _relayer);
    }

    function setMintingContract(address _mintingContract) external onlyOwner {
        address oldContract = address(mintingContract);
        mintingContract = IQobitMinting(_mintingContract);
        emit MintingContractUpdated(oldContract, _mintingContract);
    }

    function addInteractionType(string memory interactionType, uint256 basePoints, uint256 cooldownPeriod)
        external
        onlyOwner
    {
        _addInteractionType(interactionType, basePoints, cooldownPeriod);
    }

    function _addInteractionType(string memory interactionType, uint256 basePoints, uint256 cooldownPeriod) internal {
        interactionTypes[interactionType] =
            InteractionType({basePoints: basePoints, cooldownPeriod: cooldownPeriod, isActive: true});
        emit InteractionTypeAdded(interactionType, basePoints);
    }

    function executeMetaTx(
        address user,
        string calldata interaction,
        uint256 nonce,
        uint256 significance,
        bytes calldata signature
    ) external onlyRelayer nonReentrant {
        require(nonce == nonces[user], "Invalid nonce");
        require(significance >= MIN_SIGNIFICANCE && significance <= MAX_SIGNIFICANCE, "Invalid significance");

        // Verify EIP-712 signature
        _verifySignature(user, interaction, nonce, signature);

        // Extract interaction type and check cooldown
        string memory interactionType = _extractInteractionType(interaction);
        _checkCooldown(user, interactionType);

        // Calculate and store final score, update stats in one operation
        uint256 finalScore = _calculateScore(interactionType, significance);
        _updateUserStats(user, interactionType, finalScore);

        // Increment nonce
        nonces[user]++;

        // Notify minting contract and emit events
        _notifyMintingContract(user, interaction, finalScore);
        _emitEvents(user, interaction, finalScore, nonce);
    }

    function _verifySignature(
        address user,
        string calldata interaction,
        uint256 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(META_TX_TYPEHASH, user, keccak256(bytes(interaction)), nonce))
            )
        );

        address recovered = digest.recover(signature);
        require(recovered == user, "Invalid signature");
    }

    function _checkCooldown(address user, string memory interactionType) internal {
        InteractionType memory iType = interactionTypes[interactionType];

        if (iType.isActive && iType.cooldownPeriod > 0) {
            require(
                block.timestamp >= lastInteractionTime[user][interactionType] + iType.cooldownPeriod,
                "Interaction on cooldown"
            );
            lastInteractionTime[user][interactionType] = block.timestamp;
        }
    }

    function _notifyMintingContract(address user, string calldata interaction, uint256 finalScore) internal {
        if (address(mintingContract) != address(0)) {
            try mintingContract.recordInteraction(user, interaction, finalScore) {
                // Success - interaction recorded for potential rewards
            } catch {
                // Fail silently - main interaction still succeeds
            }
        }
    }

    function _emitEvents(address user, string calldata interaction, uint256 finalScore, uint256 nonce) internal {
        bytes32 txHash = keccak256(abi.encodePacked(user, interaction, nonce, block.timestamp));
        emit InteractionPerformed(user, interaction, finalScore, nonce, txHash);
        
        UserStats storage stats = userStats[user];
        emit UserScoreUpdated(user, stats.totalSignificancePoints, stats.totalInteractions);
    }

    function _updateUserStats(address user, string memory interactionType, uint256 finalScore) internal {
        UserStats storage stats = userStats[user];
        stats.totalInteractions++;
        stats.totalSignificancePoints += finalScore;
        stats.lastInteractionTime = block.timestamp;
        stats.interactionCounts[interactionType]++;
    }

    function _extractInteractionType(string memory interaction) internal pure returns (string memory) {
        bytes memory interactionBytes = bytes(interaction);
        bytes memory result = new bytes(32); // Max length for interaction type
        uint256 resultLength = 0;

        for (uint256 i = 0; i < interactionBytes.length && resultLength < 32; i++) {
            if (interactionBytes[i] == bytes1("-")) {
                break;
            }
            result[resultLength] = interactionBytes[i];
            resultLength++;
        }

        // Create properly sized bytes array
        bytes memory finalResult = new bytes(resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            finalResult[i] = result[i];
        }

        return string(finalResult);
    }

    function _calculateScore(string memory interactionType, uint256 significance) internal view returns (uint256) {
        InteractionType memory iType = interactionTypes[interactionType];
        if (!iType.isActive) {
            return significance; // Base significance if type not configured
        }

        // Formula: (basePoints * significance) / 100
        // This scales the base points by the AI-determined significance
        return (iType.basePoints * significance) / 100;
    }

    // View functions
    function verifySignature(address user, string calldata interaction, uint256 nonce, bytes calldata signature)
        external
        view
        returns (bool)
    {
        // Verify EIP-712 signature
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(META_TX_TYPEHASH, user, keccak256(bytes(interaction)), nonce))
            )
        );

        address recovered = digest.recover(signature);
        return recovered == user;
    }

    function getUserStats(address user)
        external
        view
        returns (uint256 totalInteractions, uint256 totalSignificancePoints, uint256 lastInteractionTimestamp)
    {
        UserStats storage stats = userStats[user];
        return (stats.totalInteractions, stats.totalSignificancePoints, stats.lastInteractionTime);
    }

    function getUserInteractionCount(address user, string memory interactionType) external view returns (uint256) {
        return userStats[user].interactionCounts[interactionType];
    }

    function getInteractionCooldown(address /* user */, string memory /* interactionType */) external pure returns (uint256) {
        // ALWAYS RETURN 0 - NO COOLDOWNS!
        return 0;
    }
}
