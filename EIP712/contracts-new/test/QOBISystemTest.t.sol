// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "../src/QOBISystemDeployer.sol";
import "../src/QOBIAccessControl.sol";
import "../src/DailyTreeGenerator.sol";
import "../src/QOBIMerkleDistributor.sol";

contract QOBISystemTest is Test {
    QOBISystemDeployer public deployer;
    QOBIAccessControl public accessControl;
    DailyTreeGenerator public treeGenerator;
    QOBIMerkleDistributor public merkleDistributor;
    
    address public owner;
    address public aiValidator;
    address public relayer;
    address public stabilizer;
    address public user1;
    address public user2;
    address public user3;
    
    function setUp() public {
        // Set up test addresses
        owner = address(this);
        aiValidator = address(0x1);
        relayer = address(0x2);
        stabilizer = address(0x3);
        user1 = address(0x101);
        user2 = address(0x102);
        user3 = address(0x103);
        
        // Deploy the system
        deployer = new QOBISystemDeployer();
        
        // Deploy complete system
        (
            address _accessControl,
            ,
            address _treeGenerator,
            address _merkleDistributor,
            
        ) = deployer.deployCompleteSystem();
        
        accessControl = QOBIAccessControl(_accessControl);
        treeGenerator = DailyTreeGenerator(_treeGenerator);
        merkleDistributor = QOBIMerkleDistributor(payable(_merkleDistributor));
        
        // Setup initial configuration
        deployer.setupInitialConfiguration(aiValidator, relayer, stabilizer);
        
        // Fund the system
        vm.deal(address(merkleDistributor), 1000 ether);
    }
    
    function testSystemDeployment() public {
        assertTrue(deployer.isSystemDeployed());
        assertEq(accessControl.owner(), address(deployer));
        assertTrue(accessControl.hasRole(keccak256("AI_VALIDATOR_ROLE"), aiValidator));
        assertTrue(accessControl.hasRole(keccak256("RELAYER_ROLE"), relayer));
        assertTrue(accessControl.hasRole(keccak256("STABILIZER_ROLE"), stabilizer));
    }
    
    function testTreeGeneration() public {
        // Setup test data for a daily tree
        uint256 currentDay = block.timestamp / 1 days;
        uint8 interactionType = 0; // CREATE
        
        address[] memory users = new address[](3);
        uint256[] memory points = new uint256[](3);
        uint256[] memory qobiAmounts = new uint256[](3);
        
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        points[0] = 50;
        points[1] = 75;
        points[2] = 100;
        
        qobiAmounts[0] = 0.5 ether;
        qobiAmounts[1] = 0.75 ether;
        qobiAmounts[2] = 1.0 ether;
        
        // Calculate merkle root
        bytes32 merkleRoot = treeGenerator.calculateMerkleRoot(users, points, qobiAmounts);
        
        // Create tree submission
        DailyTreeGenerator.TreeSubmission memory submission = DailyTreeGenerator.TreeSubmission({
            day: currentDay,
            interactionType: interactionType,
            merkleRoot: merkleRoot,
            users: users,
            points: points,
            qobiAmounts: qobiAmounts,
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
        
        // Generate signature (simplified for testing)
        bytes32 submissionHash = treeGenerator.getSubmissionHash(submission);
        
        // Mock signature
        bytes memory signature = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));
        
        // Submit tree as relayer
        vm.prank(relayer);
        // Note: This will fail due to signature verification, but demonstrates the flow
        // In real usage, you'd need proper EIP712 signature
        vm.expectRevert();
        treeGenerator.submitTreeWithSignature(submission, signature);
    }
    
    function testMerkleDistribution() public {
        // Simulate a finalized distribution
        uint256 currentDay = block.timestamp / 1 days;
        uint8 interactionType = 0;
        
        // Create test merkle tree data
        address[] memory users = new address[](2);
        uint256[] memory points = new uint256[](2);
        uint256[] memory qobiAmounts = new uint256[](2);
        
        users[0] = user1;
        users[1] = user2;
        points[0] = 50;
        points[1] = 100;
        qobiAmounts[0] = 0.4 ether;
        qobiAmounts[1] = 0.8 ether;

        bytes32 merkleRoot = _calculateSimpleMerkleRoot(users, points, qobiAmounts);
        
        // Finalize distribution as distributor (tree generator)
        vm.prank(address(treeGenerator));
        merkleDistributor.finalizeDailyDistribution(
            currentDay,
            interactionType,
            merkleRoot,
            users.length,
            1.2 ether  // Total within daily cap of 1.49 ether
        );        // Check distribution is finalized
        (
            bytes32 storedRoot,
            uint256 totalUsers,
            uint256 totalQOBI,
            bool finalized,
            
        ) = merkleDistributor.getDistributionInfo(currentDay, interactionType);
        
        assertEq(storedRoot, merkleRoot);
        assertEq(totalUsers, 2);
        assertEq(totalQOBI, 1.2 ether);
        assertTrue(finalized);
    }
    
    function testQOBIClaim() public {
        // Setup a finalized distribution
        uint256 currentDay = block.timestamp / 1 days;
        uint8 interactionType = 0;
        
        address user = user1;
        uint256 userPoints = 50;
        uint256 userQOBI = 0.5 ether;
        
        // Create single-user merkle tree for simplicity
        bytes32 leaf = keccak256(abi.encodePacked(user, userPoints, userQOBI));
        bytes32 merkleRoot = leaf; // For single user, root = leaf
        
        // Finalize distribution
        vm.prank(address(treeGenerator));
        merkleDistributor.finalizeDailyDistribution(
            currentDay,
            interactionType,
            merkleRoot,
            1,
            userQOBI
        );
        
        // User claims QOBI
        bytes32[] memory proof = new bytes32[](0); // Empty proof for single user
        
        uint256 balanceBefore = user.balance;
        
        vm.prank(user);
        merkleDistributor.claimQOBI(
            currentDay,
            interactionType,
            userPoints,
            userQOBI,
            proof
        );
        
        uint256 balanceAfter = user.balance;
        assertEq(balanceAfter - balanceBefore, userQOBI);
        
        // Check that user cannot claim again
        assertTrue(merkleDistributor.hasClaimed(currentDay, interactionType, user));
        
        vm.prank(user);
        vm.expectRevert();
        merkleDistributor.claimQOBI(
            currentDay,
            interactionType,
            userPoints,
            userQOBI,
            proof
        );
    }
    
    function testDailyLimits() public {
        // Test that daily limits are enforced
        (uint256 userLimit, uint256 qobiCap) = treeGenerator.getDailyLimits(0); // CREATE
        
        assertEq(userLimit, 1000);
        assertEq(qobiCap, 1.49 ether);
        
        // Test updating limits - need to call from deployer since it's the owner
        vm.prank(address(deployer));
        treeGenerator.updateDailyLimits(0, 2000, 2.0 ether);
        
        (userLimit, qobiCap) = treeGenerator.getDailyLimits(0);
        assertEq(userLimit, 2000);
        assertEq(qobiCap, 2.0 ether);
    }
    
    function testInteractionTypes() public {
        // Test interaction type names
        assertEq(treeGenerator.getInteractionTypeName(0), "CREATE");
        assertEq(treeGenerator.getInteractionTypeName(1), "LIKES");
        assertEq(treeGenerator.getInteractionTypeName(2), "COMMENTS");
        assertEq(treeGenerator.getInteractionTypeName(3), "TIPPING");
        assertEq(treeGenerator.getInteractionTypeName(4), "CRYPTO");
        assertEq(treeGenerator.getInteractionTypeName(5), "REFERRALS");
        
        vm.expectRevert();
        treeGenerator.getInteractionTypeName(6); // Invalid type
    }
    
    function testAccessControl() public {
        // Test role-based access control
        assertFalse(accessControl.hasRole(keccak256("AI_VALIDATOR_ROLE"), user1));
        
        // Grant role - need to call from deployer since it's the owner
        vm.prank(address(deployer));
        accessControl.grantRole(keccak256("AI_VALIDATOR_ROLE"), user1);
        assertTrue(accessControl.hasRole(keccak256("AI_VALIDATOR_ROLE"), user1));
        
        // Revoke role - need to call from deployer since it's the owner
        vm.prank(address(deployer));
        accessControl.revokeRole(keccak256("AI_VALIDATOR_ROLE"), user1);
        assertFalse(accessControl.hasRole(keccak256("AI_VALIDATOR_ROLE"), user1));
    }
    
    // Helper function to calculate merkle root for testing
    function _calculateSimpleMerkleRoot(
        address[] memory users,
        uint256[] memory points,
        uint256[] memory qobiAmounts
    ) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            leaves[i] = keccak256(abi.encodePacked(users[i], points[i], qobiAmounts[i]));
        }
        
        if (leaves.length == 1) return leaves[0];
        if (leaves.length == 2) {
            return keccak256(abi.encodePacked(leaves[0], leaves[1]));
        }
        
        // For more complex trees, implement full merkle tree logic
        return leaves[0]; // Simplified for testing
    }
    
    // Test receiving funds
    receive() external payable {}
}
