// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./QOBIAccessControl.sol";

interface IMerkleDistributor {
    function finalizeDailyDistribution(
        uint256 day,
        uint8 interactionType,
        bytes32 merkleRoot,
        uint256 totalUsers,
        uint256 totalQOBI
    ) external;
}

/**
 * @title DailyTreeGenerator
 * @dev Off-chain tree processor with EIP712 signature verification
 * Generates Merkle trees for daily user interactions and submits roots on-chain
 */
contract DailyTreeGenerator is Ownable {
    using ECDSA for bytes32;
    
    QOBIAccessControl public accessControl;
    address public merkleDistributor;
    
    // EIP712 Domain
    bytes32 private constant _TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    bytes32 private constant TREE_SUBMISSION_TYPEHASH = keccak256(
        "TreeSubmission(uint256 day,uint8 interactionType,bytes32 merkleRoot,address[] users,uint256[] points,uint256[] qobiAmounts,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 private immutable DOMAIN_SEPARATOR;
    
    mapping(address => bool) public authorizedRelayers;
    mapping(address => uint256) public relayerNonces;
    
    // Daily interaction limits and caps
    mapping(uint8 => uint256) public dailyUserLimits; // Max users per interaction type
    mapping(uint8 => uint256) public dailyQOBICaps;   // Max QOBI per interaction type
    
    struct TreeSubmission {
        uint256 day;
        uint8 interactionType;
        bytes32 merkleRoot;        // Calculated off-chain
        address[] users;           // Qualified user addresses
        uint256[] points;          // Points per user (0-100)
        uint256[] qobiAmounts;     // QOBI allocation per user
        uint256 nonce;
        uint256 deadline;
    }
    
    // Interaction types
    enum InteractionType {
        CREATE,     // 0 - Post Creation
        LIKES,      // 1 - Likes
        COMMENTS,   // 2 - Comments
        TIPPING,    // 3 - Tipping (Fiat & Crypto)
        CRYPTO,     // 4 - Crypto Interactions
        REFERRALS   // 5 - Referrals
    }
    
    event RelayerAuthorized(address indexed relayer);
    event RelayerDeauthorized(address indexed relayer);
    event TreeSubmitted(
        uint256 indexed day,
        uint8 indexed interactionType,
        bytes32 merkleRoot,
        uint256 userCount,
        uint256 totalQOBI,
        address relayer
    );
    event MerkleDistributorUpdated(address indexed newDistributor);
    event DailyLimitsUpdated(uint8 interactionType, uint256 userLimit, uint256 qobiCap);
    
    constructor(address _accessControl) Ownable(msg.sender) {
        accessControl = QOBIAccessControl(_accessControl);
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _TYPE_HASH,
                keccak256(bytes("QOBI Daily Tree Generator")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        
        // Initialize default daily limits based on your tokenomics
        _setDailyLimits(0, 1000, 1.49 ether);   // CREATE: max 1000 users, 1.49 QOBI cap
        _setDailyLimits(1, 5000, 0.05 ether);   // LIKES: max 5000 users, 0.05 QOBI cap
        _setDailyLimits(2, 3000, 0.6 ether);    // COMMENTS: max 3000 users, 0.6 QOBI cap
        _setDailyLimits(3, 500, 7.96 ether);    // TIPPING: max 500 users, 7.96 QOBI cap
        _setDailyLimits(4, 200, 9.95 ether);    // CRYPTO: max 200 users, 9.95 QOBI cap
        _setDailyLimits(5, 100, 11.95 ether);   // REFERRALS: max 100 users, 11.95 QOBI cap
    }
    
    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "DailyTreeGenerator: Not authorized relayer");
        _;
    }
    
    /**
     * @dev Set the merkle distributor contract address
     * @param _distributor Address of the merkle distributor
     */
    function setMerkleDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "DailyTreeGenerator: Invalid address");
        merkleDistributor = _distributor;
        emit MerkleDistributorUpdated(_distributor);
    }
    
    /**
     * @dev Authorize a relayer to submit trees
     * @param relayer Address of the relayer to authorize
     */
    function authorizeRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "DailyTreeGenerator: Invalid address");
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
     * @dev Update daily limits for an interaction type
     * @param interactionType Type of interaction (0-5)
     * @param userLimit Maximum users per day
     * @param qobiCap Maximum QOBI per day
     */
    function updateDailyLimits(
        uint8 interactionType,
        uint256 userLimit,
        uint256 qobiCap
    ) external onlyOwner {
        require(interactionType < 6, "DailyTreeGenerator: Invalid interaction type");
        _setDailyLimits(interactionType, userLimit, qobiCap);
    }
    
    function _setDailyLimits(uint8 interactionType, uint256 userLimit, uint256 qobiCap) internal {
        dailyUserLimits[interactionType] = userLimit;
        dailyQOBICaps[interactionType] = qobiCap;
        emit DailyLimitsUpdated(interactionType, userLimit, qobiCap);
    }
    
    /**
     * @dev Submit a daily Merkle tree with EIP712 signature verification
     * @param submission The tree submission data
     * @param signature The EIP712 signature
     */
    function submitTreeWithSignature(
        TreeSubmission calldata submission,
        bytes calldata signature
    ) external onlyAuthorizedRelayer {
        require(submission.deadline >= block.timestamp, "DailyTreeGenerator: Signature expired");
        require(submission.interactionType < 6, "DailyTreeGenerator: Invalid interaction type");
        require(submission.users.length == submission.points.length, "DailyTreeGenerator: Array length mismatch");
        require(submission.users.length == submission.qobiAmounts.length, "DailyTreeGenerator: Array length mismatch");
        require(submission.users.length > 0, "DailyTreeGenerator: No users provided");
        
        // Check daily limits
        require(
            submission.users.length <= dailyUserLimits[submission.interactionType],
            "DailyTreeGenerator: Exceeds daily user limit"
        );
        
        // Verify EIP712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                TREE_SUBMISSION_TYPEHASH,
                submission.day,
                submission.interactionType,
                submission.merkleRoot,
                keccak256(abi.encodePacked(submission.users)),
                keccak256(abi.encodePacked(submission.points)),
                keccak256(abi.encodePacked(submission.qobiAmounts)),
                submission.nonce,
                submission.deadline
            )
        );
        
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = hash.recover(signature);
        
        require(authorizedRelayers[signer], "DailyTreeGenerator: Invalid signer");
        require(relayerNonces[signer] == submission.nonce, "DailyTreeGenerator: Invalid nonce");
        
        // Increment nonce
        relayerNonces[signer]++;
        
        // Verify merkle root matches the provided data
        bytes32 calculatedRoot = calculateMerkleRoot(
            submission.users,
            submission.points,
            submission.qobiAmounts
        );
        require(calculatedRoot == submission.merkleRoot, "DailyTreeGenerator: Invalid merkle root");
        
        // Validate points (0-100 for each user)
        for (uint256 i = 0; i < submission.points.length; i++) {
            require(submission.points[i] <= 100, "DailyTreeGenerator: Invalid points");
        }
        
        // Calculate total QOBI and validate against daily cap
        uint256 totalQOBI = 0;
        for (uint256 i = 0; i < submission.qobiAmounts.length; i++) {
            totalQOBI += submission.qobiAmounts[i];
        }
        
        require(
            totalQOBI <= dailyQOBICaps[submission.interactionType],
            "DailyTreeGenerator: Exceeds daily QOBI cap"
        );
        
        // Submit to distributor
        require(merkleDistributor != address(0), "DailyTreeGenerator: Distributor not set");
        IMerkleDistributor(merkleDistributor).finalizeDailyDistribution(
            submission.day,
            submission.interactionType,
            submission.merkleRoot,
            submission.users.length,
            totalQOBI
        );
        
        emit TreeSubmitted(
            submission.day,
            submission.interactionType,
            submission.merkleRoot,
            submission.users.length,
            totalQOBI,
            signer
        );
    }
    
    /**
     * @dev Calculate Merkle root from user data
     * @param users Array of user addresses
     * @param points Array of user points
     * @param qobiAmounts Array of QOBI amounts
     * @return The calculated Merkle root
     */
    function calculateMerkleRoot(
        address[] calldata users,
        uint256[] calldata points,
        uint256[] calldata qobiAmounts
    ) public pure returns (bytes32) {
        require(users.length > 0, "DailyTreeGenerator: No users");
        require(users.length == points.length, "DailyTreeGenerator: Length mismatch");
        require(users.length == qobiAmounts.length, "DailyTreeGenerator: Length mismatch");
        
        bytes32[] memory leaves = new bytes32[](users.length);
        
        // Create leaves: hash(user, points, qobiAmount)
        for (uint256 i = 0; i < users.length; i++) {
            leaves[i] = keccak256(abi.encodePacked(users[i], points[i], qobiAmounts[i]));
        }
        
        // Calculate merkle root using standard algorithm
        return _calculateMerkleRootFromLeaves(leaves);
    }
    
    /**
     * @dev Internal function to calculate Merkle root from leaves
     * @param leaves Array of leaf hashes
     * @return The Merkle root
     */
    function _calculateMerkleRootFromLeaves(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        if (leaves.length == 1) return leaves[0];
        
        // Build tree bottom up
        while (leaves.length > 1) {
            bytes32[] memory nextLevel = new bytes32[]((leaves.length + 1) / 2);
            
            for (uint256 i = 0; i < leaves.length; i += 2) {
                if (i + 1 < leaves.length) {
                    // Hash pair
                    nextLevel[i / 2] = keccak256(abi.encodePacked(leaves[i], leaves[i + 1]));
                } else {
                    // Odd number - promote single node
                    nextLevel[i / 2] = leaves[i];
                }
            }
            leaves = nextLevel;
        }
        
        return leaves[0];
    }
    
    /**
     * @dev Generate a tree submission hash for verification
     * @param submission The tree submission data
     * @return The EIP712 hash
     */
    function getSubmissionHash(TreeSubmission calldata submission) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                TREE_SUBMISSION_TYPEHASH,
                submission.day,
                submission.interactionType,
                submission.merkleRoot,
                keccak256(abi.encodePacked(submission.users)),
                keccak256(abi.encodePacked(submission.points)),
                keccak256(abi.encodePacked(submission.qobiAmounts)),
                submission.nonce,
                submission.deadline
            )
        );
        
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
    
    /**
     * @dev Get the domain separator
     * @return The EIP712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }
    
    /**
     * @dev Get relayer nonce
     * @param relayer Address of the relayer
     * @return Current nonce for the relayer
     */
    function getRelayerNonce(address relayer) external view returns (uint256) {
        return relayerNonces[relayer];
    }
    
    /**
     * @dev Get current day timestamp
     * @return Current day as timestamp / 1 days
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / 1 days;
    }
    
    /**
     * @dev Get daily limits for an interaction type
     * @param interactionType The interaction type (0-5)
     * @return userLimit Maximum users per day
     * @return qobiCap Maximum QOBI per day
     */
    function getDailyLimits(uint8 interactionType) external view returns (uint256 userLimit, uint256 qobiCap) {
        require(interactionType < 6, "DailyTreeGenerator: Invalid interaction type");
        return (dailyUserLimits[interactionType], dailyQOBICaps[interactionType]);
    }
    
    /**
     * @dev Get interaction type name
     * @param interactionType The interaction type (0-5)
     * @return The name of the interaction type
     */
    function getInteractionTypeName(uint8 interactionType) external pure returns (string memory) {
        require(interactionType < 6, "DailyTreeGenerator: Invalid interaction type");
        
        string[6] memory names = [
            "CREATE",
            "LIKES", 
            "COMMENTS",
            "TIPPING",
            "CRYPTO",
            "REFERRALS"
        ];
        
        return names[interactionType];
    }
}
