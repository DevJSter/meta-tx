// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Minting.sol";
import "../src/EIPMetaTx.sol";

contract QobitTokenTest is Test {
    QobitToken public qobitToken;
    MetaTxInteraction public metaTxContract;

    address public owner;
    address public user1;
    address public user2;
    address public relayer;

    uint256 constant INITIAL_SUPPLY = 1000000e18; // 1M tokens
    uint256 constant TEST_POINTS = 500; // 5.0 significance points
    uint256 constant MIN_POINTS_THRESHOLD = 100; // 1.0 points minimum

    function setUp() public {
        owner = address(this);
        user1 = vm.addr(1);
        user2 = vm.addr(2);
        relayer = vm.addr(3);

        // Deploy contracts
        qobitToken = new QobitToken();
        metaTxContract = new MetaTxInteraction();

        // Configure contracts
        qobitToken.setMetaTxContract(address(metaTxContract));
        metaTxContract.setMintingContract(address(qobitToken));
        metaTxContract.setAuthorizedRelayer(relayer);
    }

    function testInitialState() public view {
        // Check initial supply went to owner
        assertEq(qobitToken.balanceOf(owner), INITIAL_SUPPLY);
        assertEq(qobitToken.totalSupply(), INITIAL_SUPPLY);

        // Check initial parameters
        assertEq(qobitToken.baseRewardPerPoint(), 1e15); // 0.001 tokens per point
        assertEq(qobitToken.maxDailyMint(), 100e18); // 100 tokens max
        assertEq(qobitToken.minPointsThreshold(), 100); // 1.0 points minimum

        // Check token details
        assertEq(qobitToken.name(), "Qobit Token");
        assertEq(qobitToken.symbol(), "QBIT");
        assertEq(qobitToken.decimals(), 18);
    }

    function testRecordInteraction() public {
        string memory interaction = "create_post-test";
        uint256 significance = TEST_POINTS;

        // Record interaction as authorized contract
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, interaction, significance);

        // Check user reward info
        (
            uint256 totalPoints,
            uint256 dailyPoints,
            uint256 totalMinted,
            uint256 streakDays,
            bool canMintToday,
            uint256 estimatedReward
        ) = qobitToken.getUserRewardInfo(user1);

        assertEq(totalPoints, significance);
        assertEq(dailyPoints, significance);
        assertEq(totalMinted, 0);
        assertEq(streakDays, 0);
        assertTrue(canMintToday); // Should be able to mint with sufficient points
        assertGt(estimatedReward, 0);
    }

    function testUnauthorizedRecordFails() public {
        string memory interaction = "create_post-unauthorized";
        uint256 significance = TEST_POINTS;

        // Try to record as unauthorized user
        vm.expectRevert("Not authorized");
        vm.prank(user1);
        qobitToken.recordInteraction(user1, interaction, significance);
    }

    function testMintDailyReward() public {
        // First record some interactions
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "create_post-mint-test", TEST_POINTS);

        uint256 initialBalance = qobitToken.balanceOf(user1);

        // Mint daily reward
        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 finalBalance = qobitToken.balanceOf(user1);
        assertGt(finalBalance, initialBalance);

        // Check that daily points are reset
        (, uint256 dailyPoints,,,,) = qobitToken.getUserRewardInfo(user1);
        assertEq(dailyPoints, 0);

        // Check that user can't mint again today
        assertTrue(qobitToken.hasUserMintedToday(user1));
    }

    function testCannotMintTwicePerDay() public {
        // Record interaction and mint
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "create_post-double-mint", TEST_POINTS);

        vm.prank(user1);
        qobitToken.mintDailyReward();

        // Try to mint again
        vm.expectRevert("Already minted today");
        vm.prank(user1);
        qobitToken.mintDailyReward();
    }

    function testInsufficientPointsCannotMint() public {
        // Record interaction with insufficient points
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "like_post-insufficient", 50); // Below threshold

        vm.expectRevert("Insufficient daily points");
        vm.prank(user1);
        qobitToken.mintDailyReward();
    }

    function testStreakBonus() public {
        // Day 1: Record and mint
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "day1_post", TEST_POINTS);

        uint256 balanceBeforeFirstMint = qobitToken.balanceOf(user1);
        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 day1Gain = qobitToken.balanceOf(user1) - balanceBeforeFirstMint;

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Day 2: Record and mint (should get streak bonus)
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "day2_post", TEST_POINTS);

        uint256 balanceBeforeDay2 = qobitToken.balanceOf(user1);

        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 day2Gain = qobitToken.balanceOf(user1) - balanceBeforeDay2;

        // Day 2 should have higher or equal reward due to streak bonus
        assertGe(day2Gain, day1Gain);
    }

    function testLeaderboardUpdates() public {
        // Record interactions for multiple users
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "user1_post", 800); // High points

        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user2, "user2_post", 300); // Lower points

        // Check leaderboard
        QobitToken.LeaderboardEntry[] memory leaderboard = qobitToken.getLeaderboard(10);

        assertTrue(leaderboard.length >= 2);
        assertEq(leaderboard[0].user, user1); // Should be first (highest points)
        assertEq(leaderboard[1].user, user2); // Should be second
        assertEq(leaderboard[0].points, 800);
        assertEq(leaderboard[1].points, 300);
    }

    function testMaxDailyMintCap() public {
        // Set very low max daily mint for testing
        qobitToken.updateRewardParameters(1e18, 1e18, 100); // 1 token max daily mint

        // Record massive points
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "massive_post", 100000); // 1000 points

        uint256 balanceBefore = qobitToken.balanceOf(user1);

        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 gained = qobitToken.balanceOf(user1) - balanceBefore;

        // Should be capped at max daily mint
        assertEq(gained, 1e18); // 1 token
    }

    function testOwnerFunctions() public {
        address newMetaTx = vm.addr(999);

        // Test setMetaTxContract
        qobitToken.setMetaTxContract(newMetaTx);
        assertTrue(qobitToken.authorizedContracts(newMetaTx));

        // Test updateRewardParameters
        qobitToken.updateRewardParameters(2e15, 200e18, 200);
        assertEq(qobitToken.baseRewardPerPoint(), 2e15);
        assertEq(qobitToken.maxDailyMint(), 200e18);
        assertEq(qobitToken.minPointsThreshold(), 200);

        // Test setAuthorizedContract
        address testContract = vm.addr(888);
        qobitToken.setAuthorizedContract(testContract, true);
        assertTrue(qobitToken.authorizedContracts(testContract));

        qobitToken.setAuthorizedContract(testContract, false);
        assertFalse(qobitToken.authorizedContracts(testContract));
    }

    function testNonOwnerCannotCallOwnerFunctions() public {
        vm.expectRevert();
        vm.prank(user1);
        qobitToken.setMetaTxContract(vm.addr(123));

        vm.expectRevert();
        vm.prank(user1);
        qobitToken.updateRewardParameters(1e15, 100e18, 100);

        vm.expectRevert();
        vm.prank(user1);
        qobitToken.setAuthorizedContract(vm.addr(123), true);
    }

    function testDailyPointsHistory() public {
        uint256 currentDay = qobitToken.getCurrentDay();

        // Record interaction
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "history_test", TEST_POINTS);

        // Check daily points for current day
        uint256 dailyPoints = qobitToken.getUserDailyPoints(user1, currentDay);
        assertEq(dailyPoints, TEST_POINTS);

        // Check future day (should be 0) - avoid underflow by using future day
        uint256 futureDay = currentDay + 1;
        uint256 futureDayPoints = qobitToken.getUserDailyPoints(user1, futureDay);
        assertEq(futureDayPoints, 0);
    }

    function testMultipleInteractionsSameDay() public {
        // Record multiple interactions on same day
        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "interaction1", 200);

        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "interaction2", 300);

        // Check accumulated points
        (uint256 totalPoints, uint256 dailyPoints,,,,) = qobitToken.getUserRewardInfo(user1);
        assertEq(totalPoints, 500);
        assertEq(dailyPoints, 500);

        // Should be able to mint larger reward
        uint256 balanceBefore = qobitToken.balanceOf(user1);

        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 reward = qobitToken.balanceOf(user1) - balanceBefore;
        uint256 expectedReward = (500 * 1e15) / 100; // 500 points * base rate / decimals
        assertEq(reward, expectedReward);
    }

    function testRewardCalculation() public {
        // Test exact reward calculation
        uint256 points = 250; // 2.5 points
        uint256 expectedReward = (points * 1e15) / 100; // base rate calculation

        vm.prank(address(metaTxContract));
        qobitToken.recordInteraction(user1, "calc_test", points);

        (,,,,, uint256 estimatedReward) = qobitToken.getUserRewardInfo(user1);
        assertEq(estimatedReward, expectedReward);

        uint256 balanceBefore = qobitToken.balanceOf(user1);

        vm.prank(user1);
        qobitToken.mintDailyReward();

        uint256 actualReward = qobitToken.balanceOf(user1) - balanceBefore;
        assertEq(actualReward, expectedReward);
    }
}
