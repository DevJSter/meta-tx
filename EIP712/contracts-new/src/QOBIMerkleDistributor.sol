// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./QOBIAccessControl.sol";
import "./StabilizingContract.sol";

/**
 * @title QOBIMerkleDistributor
 * @dev Main contract for distributing QOBI tokens based on Merkle proofs
 * Handles daily distributions for different interaction types
 */
contract QOBIMerkleDistributor is Ownable, ReentrancyGuard {
    QOBIAccessControl public accessControl;
    StabilizingContract public stabilizingContract;
    
    struct DailyDistribution {
        bytes32 merkleRoot;
        uint256 totalUsers;
        uint256 totalQOBI;
        bool finalized;
        uint256 timestamp;
    }
    
    // day => interactionType => distribution data
    mapping(uint256 => mapping(uint8 => DailyDistribution)) public distributions;
    
    // Prevent double claiming: hash(day, interactionType, user) => claimed
    mapping(bytes32 => bool) public claimed;
    
    // Daily QOBI caps per interaction type (from your tokenomics)
    uint256[6] public dailyQOBICaps = [
        1.49 ether,  // CREATE: 1.49 QOBI (30 points/month, 2 posts, 0.5 points each)
        0.05 ether,  // LIKES: 0.05 QOBI (5 likes/day, 0.1 per like, 15 points monthly)
        0.6 ether,   // COMMENTS: 0.6 QOBI (5 comments/day, 0.1 per comment, 15 points monthly)
        7.96 ether,  // TIPPING: 7.96 QOBI (20 points for tipping)
        9.95 ether,  // CRYPTO: 9.95 QOBI (Token generation + crypto interactions)
        11.95 ether  // REFERRALS: 11.95 QOBI (10 points/month + verification bonus)
    ];
    
    // Interaction type names for events
    string[6] public interactionNames = [
        "CREATE",
        "LIKES", 
        "COMMENTS",
        "TIPPING",
        "CRYPTO",
        "REFERRALS"
    ];
    
    enum InteractionType {
        CREATE,     // 0
        LIKES,      // 1
        COMMENTS,   // 2
        TIPPING,    // 3
        CRYPTO,     // 4
        REFERRALS   // 5
    }
    
    event DailyDistributionFinalized(
        uint256 indexed day,
        uint8 indexed interactionType,
        bytes32 merkleRoot,
        uint256 totalUsers,
        uint256 totalQOBI
    );
    
    event QOBIClaimed(
        address indexed user,
        uint256 indexed day,
        uint8 indexed interactionType,
        uint256 points,
        uint256 qobiAmount
    );
    
    event EmergencyWithdraw(address indexed owner, uint256 amount);
    event DailyCapUpdated(uint8 indexed interactionType, uint256 oldCap, uint256 newCap);
    event StabilizingContractUpdated(address indexed newContract);
    
    constructor(address _accessControl) Ownable(msg.sender) {
        accessControl = QOBIAccessControl(_accessControl);
    }
    
    modifier onlyDistributor() {
        require(
            accessControl.hasRole(keccak256("DISTRIBUTOR_ROLE"), msg.sender),
            "QOBIMerkleDistributor: Not distributor"
        );
        _;
    }
    
    /**
     * @dev Set the stabilizing contract address
     * @param _stabilizing Address of the stabilizing contract
     */
    function setStabilizingContract(address payable _stabilizing) external onlyOwner {
        require(_stabilizing != address(0), "QOBIMerkleDistributor: Invalid address");
        stabilizingContract = StabilizingContract(_stabilizing);
        emit StabilizingContractUpdated(_stabilizing);
    }
    
    /**
     * @dev Update daily QOBI caps for interaction types
     * @param newCaps Array of new caps for each interaction type
     */
    function updateDailyQOBICaps(uint256[6] calldata newCaps) external onlyOwner {
        for (uint8 i = 0; i < 6; i++) {
            require(newCaps[i] > 0, "QOBIMerkleDistributor: Invalid cap");
            uint256 oldCap = dailyQOBICaps[i];
            dailyQOBICaps[i] = newCaps[i];
            emit DailyCapUpdated(i, oldCap, newCaps[i]);
        }
    }
    
    /**
     * @dev Finalize daily distribution (called by authorized tree generator)
     * @param day Day timestamp (block.timestamp / 1 days)
     * @param interactionType Type of interaction (0-5)
     * @param merkleRoot Merkle root of the distribution tree
     * @param totalUsers Total number of users in distribution
     * @param totalQOBI Total QOBI amount to be distributed
     */
    function finalizeDailyDistribution(
        uint256 day,
        uint8 interactionType,
        bytes32 merkleRoot,
        uint256 totalUsers,
        uint256 totalQOBI
    ) external onlyDistributor {
        require(interactionType < 6, "QOBIMerkleDistributor: Invalid interaction type");
        require(!distributions[day][interactionType].finalized, "QOBIMerkleDistributor: Already finalized");
        require(merkleRoot != bytes32(0), "QOBIMerkleDistributor: Invalid merkle root");
        require(totalUsers > 0, "QOBIMerkleDistributor: No users");
        require(totalQOBI > 0, "QOBIMerkleDistributor: No QOBI");
        
        // Validate total QOBI doesn't exceed daily caps
        require(totalQOBI <= dailyQOBICaps[interactionType], "QOBIMerkleDistributor: Exceeds daily QOBI cap");
        
        distributions[day][interactionType] = DailyDistribution({
            merkleRoot: merkleRoot,
            totalUsers: totalUsers,
            totalQOBI: totalQOBI,
            finalized: true,
            timestamp: block.timestamp
        });
        
        emit DailyDistributionFinalized(day, interactionType, merkleRoot, totalUsers, totalQOBI);
    }
    
    /**
     * @dev Claim QOBI tokens for a specific day and interaction type
     * @param day Day of the distribution
     * @param interactionType Type of interaction
     * @param points Points earned (0-100)
     * @param qobiAmount QOBI amount to claim
     * @param merkleProof Merkle proof for verification
     */
    function claimQOBI(
        uint256 day,
        uint8 interactionType,
        uint256 points,
        uint256 qobiAmount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        require(interactionType < 6, "QOBIMerkleDistributor: Invalid interaction type");
        require(points <= 100, "QOBIMerkleDistributor: Invalid points");
        require(qobiAmount > 0, "QOBIMerkleDistributor: Invalid QOBI amount");
        
        // Generate unique claim ID
        bytes32 claimId = getClaimId(day, interactionType, msg.sender);
        require(!claimed[claimId], "QOBIMerkleDistributor: Already claimed");
        
        DailyDistribution storage dist = distributions[day][interactionType];
        require(dist.finalized, "QOBIMerkleDistributor: Distribution not finalized");
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, points, qobiAmount));
        require(
            MerkleProof.verify(merkleProof, dist.merkleRoot, leaf),
            "QOBIMerkleDistributor: Invalid merkle proof"
        );
        
        // Validate QOBI amount against daily cap and points earned
        uint256 maxQOBI = (dailyQOBICaps[interactionType] * points) / 100;
        require(qobiAmount <= maxQOBI, "QOBIMerkleDistributor: QOBI amount exceeds limit");
        
        // Mark as claimed
        claimed[claimId] = true;
        
        // Transfer native QOBI tokens
        require(address(this).balance >= qobiAmount, "QOBIMerkleDistributor: Insufficient contract balance");
        payable(msg.sender).transfer(qobiAmount);
        
        emit QOBIClaimed(msg.sender, day, interactionType, points, qobiAmount);
    }
    
    /**
     * @dev Batch claim QOBI for multiple days/interaction types
     */
    function batchClaimQOBI(
        uint256[] calldata daysArray,
        uint8[] calldata interactionTypesArray,
        uint256[] calldata pointsArray,
        uint256[] calldata qobiAmountsArray,
        bytes32[][] calldata merkleProofsArray
    ) external nonReentrant {
        require(daysArray.length == interactionTypesArray.length, "QOBIMerkleDistributor: Array length mismatch");
        require(daysArray.length == pointsArray.length, "QOBIMerkleDistributor: Array length mismatch");
        require(daysArray.length == qobiAmountsArray.length, "QOBIMerkleDistributor: Array length mismatch");
        require(daysArray.length == merkleProofsArray.length, "QOBIMerkleDistributor: Array length mismatch");
        require(daysArray.length > 0, "QOBIMerkleDistributor: Empty arrays");
        
        uint256 totalClaim = 0;
        uint256 successfulClaims = 0;
        
        for (uint256 i = 0; i < daysArray.length; i++) {
            bytes32 claimId = getClaimId(daysArray[i], interactionTypesArray[i], msg.sender);
            
            if (!claimed[claimId] && 
                distributions[daysArray[i]][interactionTypesArray[i]].finalized &&
                interactionTypesArray[i] < 6 &&
                pointsArray[i] <= 100 &&
                qobiAmountsArray[i] > 0) {
                
                bytes32 leaf = keccak256(abi.encodePacked(msg.sender, pointsArray[i], qobiAmountsArray[i]));
                
                if (MerkleProof.verify(merkleProofsArray[i], distributions[daysArray[i]][interactionTypesArray[i]].merkleRoot, leaf)) {
                    // Validate QOBI amount
                    uint256 maxQOBI = (dailyQOBICaps[interactionTypesArray[i]] * pointsArray[i]) / 100;
                    if (qobiAmountsArray[i] <= maxQOBI) {
                        claimed[claimId] = true;
                        totalClaim += qobiAmountsArray[i];
                        successfulClaims++;
                        
                        emit QOBIClaimed(msg.sender, daysArray[i], interactionTypesArray[i], pointsArray[i], qobiAmountsArray[i]);
                    }
                }
            }
        }
        
        require(successfulClaims > 0, "QOBIMerkleDistributor: No valid claims");
        require(address(this).balance >= totalClaim, "QOBIMerkleDistributor: Insufficient contract balance");
        
        payable(msg.sender).transfer(totalClaim);
    }
    
    /**
     * @dev Check if a user can claim for specific distribution
     * @param day Day of the distribution
     * @param interactionType Type of interaction
     * @param user Address of the user
     * @param points Points earned
     * @param qobiAmount QOBI amount to claim
     * @param merkleProof Merkle proof
     * @return True if claimable
     */
    function isClaimable(
        uint256 day,
        uint8 interactionType,
        address user,
        uint256 points,
        uint256 qobiAmount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        if (interactionType >= 6) return false;
        if (points > 100) return false;
        if (qobiAmount == 0) return false;
        
        bytes32 claimId = getClaimId(day, interactionType, user);
        if (claimed[claimId]) return false;
        if (!distributions[day][interactionType].finalized) return false;
        
        // Validate QOBI amount
        uint256 maxQOBI = (dailyQOBICaps[interactionType] * points) / 100;
        if (qobiAmount > maxQOBI) return false;
        
        bytes32 leaf = keccak256(abi.encodePacked(user, points, qobiAmount));
        return MerkleProof.verify(merkleProof, distributions[day][interactionType].merkleRoot, leaf);
    }
    
    /**
     * @dev Check if user has already claimed for specific distribution
     * @param day Day of the distribution
     * @param interactionType Type of interaction
     * @param user Address of the user
     * @return True if already claimed
     */
    function hasClaimed(uint256 day, uint8 interactionType, address user) external view returns (bool) {
        bytes32 claimId = getClaimId(day, interactionType, user);
        return claimed[claimId];
    }
    
    /**
     * @dev Get claim ID for a user's distribution
     * @param day Day of the distribution
     * @param interactionType Type of interaction
     * @param user Address of the user
     * @return Unique claim ID
     */
    function getClaimId(uint256 day, uint8 interactionType, address user) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(day, interactionType, user));
    }
    
    /**
     * @dev Get distribution information
     * @param day Day of the distribution
     * @param interactionType Type of interaction
     * @return merkleRoot Merkle root of the distribution
     * @return totalUsers Total users in distribution
     * @return totalQOBI Total QOBI in distribution
     * @return finalized Whether distribution is finalized
     * @return timestamp When distribution was finalized
     */
    function getDistributionInfo(uint256 day, uint8 interactionType) external view returns (
        bytes32 merkleRoot,
        uint256 totalUsers,
        uint256 totalQOBI,
        bool finalized,
        uint256 timestamp
    ) {
        require(interactionType < 6, "QOBIMerkleDistributor: Invalid interaction type");
        DailyDistribution storage dist = distributions[day][interactionType];
        return (dist.merkleRoot, dist.totalUsers, dist.totalQOBI, dist.finalized, dist.timestamp);
    }
    
    /**
     * @dev Get daily QOBI cap for interaction type
     * @param interactionType Type of interaction
     * @return Daily QOBI cap
     */
    function getDailyQOBICap(uint8 interactionType) external view returns (uint256) {
        require(interactionType < 6, "QOBIMerkleDistributor: Invalid interaction type");
        return dailyQOBICaps[interactionType];
    }
    
    /**
     * @dev Get interaction type name
     * @param interactionType Type of interaction
     * @return Name of the interaction type
     */
    function getInteractionTypeName(uint8 interactionType) external view returns (string memory) {
        require(interactionType < 6, "QOBIMerkleDistributor: Invalid interaction type");
        return interactionNames[interactionType];
    }
    
    /**
     * @dev Get current day timestamp
     * @return Current day as timestamp / 1 days
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / 1 days;
    }
    
    /**
     * @dev Get contract balance
     * @return Current contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get user's pending claims for a specific day
     * @param user Address of the user
     * @param day Day to check
     * @return pendingTypes Array of interaction types with pending claims
     */
    function getPendingClaims(address user, uint256 day) external view returns (uint8[] memory pendingTypes) {
        uint8 count = 0;
        
        // First pass: count pending claims
        for (uint8 i = 0; i < 6; i++) {
            bytes32 claimId = getClaimId(day, i, user);
            if (!claimed[claimId] && distributions[day][i].finalized) {
                count++;
            }
        }
        
        // Second pass: populate array
        pendingTypes = new uint8[](count);
        uint8 index = 0;
        for (uint8 i = 0; i < 6; i++) {
            bytes32 claimId = getClaimId(day, i, user);
            if (!claimed[claimId] && distributions[day][i].finalized) {
                pendingTypes[index] = i;
                index++;
            }
        }
    }
    
    /**
     * @dev Emergency pause claims (only owner)
     */
    function pause() external onlyOwner {
        // Implementation for pausing claims in emergency
        // This would require adding Pausable from OpenZeppelin
    }
    
    /**
     * @dev Emergency withdraw funds (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "QOBIMerkleDistributor: Insufficient balance");
        payable(owner()).transfer(amount);
        emit EmergencyWithdraw(owner(), amount);
    }
    
    // Receive native QOBI tokens
    receive() external payable {}
    fallback() external payable {}
}
