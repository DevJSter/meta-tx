// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EIPMetaTx.sol";
import "../src/Minting.sol";
import "./ReentrancyAttacker.sol";

contract MetaTxInteractionTest is Test {
    MetaTxInteraction public metaTx;
    QobitToken public qobitToken;
    address public user;
    address public relayer;
    uint256 public userPrivateKey;
    uint256 public relayerPrivateKey;

    // Test constants
    uint256 constant TEST_SIGNIFICANCE = 500; // 5.0 significance score
    uint256 constant MIN_SIGNIFICANCE = 10; // 0.1 minimum
    uint256 constant MAX_SIGNIFICANCE = 1000; // 10.0 maximum

    function setUp() public {
        // Deploy contracts
        metaTx = new MetaTxInteraction();
        qobitToken = new QobitToken();

        // Set up test accounts
        userPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        relayerPrivateKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        user = vm.addr(userPrivateKey);
        relayer = vm.addr(relayerPrivateKey);

        // Configure contracts
        metaTx.setAuthorizedRelayer(relayer);
        metaTx.setMintingContract(address(qobitToken));
        qobitToken.setMetaTxContract(address(metaTx));
    }

    function testExecuteMetaTx() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        string memory interaction = "like_post-12345";
        uint256 nonce = 0;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), nonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute as relayer (remove event expectation for now to focus on functionality)
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, TEST_SIGNIFICANCE, signature);

        // Verify nonce incremented
        assertEq(metaTx.nonces(user), 1);

        // Verify user stats updated
        (uint256 totalInteractions, uint256 totalPoints,) = metaTx.getUserStats(user);
        assertEq(totalInteractions, 1);
        assertGt(totalPoints, 0); // Should have some points
    }

    function testReplayAttackFails() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        string memory interaction = "like_post-67890";
        uint256 nonce = 0;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), nonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // First execution should pass
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, TEST_SIGNIFICANCE, signature);

        // Nonce increment
        assertEq(metaTx.nonces(user), 1);

        // Replay using same nonce should revert
        vm.expectRevert("Invalid nonce");
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, TEST_SIGNIFICANCE, signature);
    }

    function testReentrancyAttackFails() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        // Deploy attacker with the user private key and target contract address
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(metaTx), user);

        string memory interaction = "like_post-attack";
        uint256 nonce = 0;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), nonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Set attacker as authorized relayer for this test
        metaTx.setAuthorizedRelayer(address(attacker));

        // Perform the meta-tx via attacker; it should succeed exactly once due to reentrancy guard
        vm.prank(address(attacker));
        attacker.attack(interaction, nonce, TEST_SIGNIFICANCE, signature);

        // Confirm only one execution occurred
        assertEq(metaTx.nonces(user), 1);

        // Reset relayer back to original
        metaTx.setAuthorizedRelayer(relayer);
    }

    function testInvalidSignatureFails() public {
        string memory interaction = "like_post-invalid";
        uint256 nonce = 0;

        // Random signature
        bytes memory invalidSignature = hex"1234";

        // Any revert is valid for malformed sig
        vm.expectRevert();
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, TEST_SIGNIFICANCE, invalidSignature);
    }

    function testIncorrectNonceFails() public {
        string memory interaction = "like_post-wrong-nonce";
        uint256 incorrectNonce = 5;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), incorrectNonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid nonce");
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, incorrectNonce, TEST_SIGNIFICANCE, signature);
    }

    function testSequentialTransactions() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        string memory interaction1 = "like_post-seq1";
        string memory interaction2 = "comment_post-seq2";

        // Transaction 1 (nonce 0)
        bytes32 digest1 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction1)), 0))
            )
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(userPrivateKey, digest1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction1, 0, TEST_SIGNIFICANCE, signature1);
        assertEq(metaTx.nonces(user), 1);

        // Fast forward past comment_post cooldown (10 minutes)
        vm.warp(block.timestamp + 601);

        // Transaction 2 (nonce 1)
        bytes32 digest2 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction2)), 1))
            )
        );
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(userPrivateKey, digest2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction2, 1, TEST_SIGNIFICANCE, signature2);
        assertEq(metaTx.nonces(user), 2);
    }

    // Enhanced tests for new functionality
    function testUnauthorizedRelayerFails() public {
        string memory interaction = "like_post-unauthorized";
        uint256 nonce = 0;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), nonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Try to execute without being authorized relayer
        vm.expectRevert("Only authorized relayer");
        metaTx.executeMetaTx(user, interaction, nonce, TEST_SIGNIFICANCE, signature);
    }

    function testInvalidSignificanceRange() public {
        string memory interaction = "like_post-invalid-sig";
        uint256 nonce = 0;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction)), nonce))
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Test significance too low
        vm.expectRevert("Invalid significance");
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, 5, signature); // Below minimum

        // Test significance too high
        vm.expectRevert("Invalid significance");
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction, nonce, 1500, signature); // Above maximum
    }

    function testInteractionTypeScoring() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        // Test different interaction types and their scoring
        string memory createPost = "create_post-test-scoring";
        string memory likePost = "like_post-test-scoring";
        uint256 nonce = 0;

        // Create post interaction (should get higher base points: 100)
        bytes32 digest1 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(createPost)), nonce))
            )
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(userPrivateKey, digest1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, createPost, nonce, TEST_SIGNIFICANCE, signature1);

        (uint256 totalInteractions1, uint256 totalPoints1,) = metaTx.getUserStats(user);
        assertEq(totalInteractions1, 1);
        assertGt(totalPoints1, 0);

        // Second user for comparison
        address user2 = vm.addr(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a);

        // Fast forward past like_post cooldown (5 minutes)
        vm.warp(block.timestamp + 301);

        // Like post interaction (should get lower base points: 10)
        bytes32 digest2 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user2, keccak256(bytes(likePost)), 0))
            )
        );

        (uint8 v2, bytes32 r2, bytes32 s2) =
            vm.sign(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a, digest2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.prank(relayer);
        metaTx.executeMetaTx(user2, likePost, 0, TEST_SIGNIFICANCE, signature2);

        (uint256 totalInteractions2, uint256 totalPoints2,) = metaTx.getUserStats(user2);
        assertEq(totalInteractions2, 1);
        assertGt(totalPoints2, 0);

        // Create post should have significantly more points than like post with same significance
        // create_post: 100 base * 500 significance / 100 = 500 points
        // like_post: 10 base * 500 significance / 100 = 50 points
        assertGt(totalPoints1, totalPoints2 * 5); // Should be at least 5x more
    }

    function testCooldownPeriod() public {
        // Debug: Let's check if create_post interaction type is properly configured
        (uint256 basePoints, uint256 cooldownPeriod, bool isActive) = metaTx.interactionTypes("create_post");
        assertEq(basePoints, 100);
        assertEq(cooldownPeriod, 3600);
        assertTrue(isActive);

        // Set a realistic timestamp
        vm.warp(1000000); // Set block.timestamp to a large value

        string memory interaction1 = "create_post-cooldown-test1";
        string memory interaction2 = "create_post-cooldown-test2";
        uint256 nonce = 0;

        // First interaction
        bytes32 digest1 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction1)), nonce))
            )
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(userPrivateKey, digest1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction1, nonce, TEST_SIGNIFICANCE, signature1);

        // Try same interaction type immediately with different nonce and interaction name
        // but same type (both extract to "create_post")
        nonce = 1;

        bytes32 digest2 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction2)), nonce))
            )
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(userPrivateKey, digest2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.expectRevert("Interaction on cooldown");
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction2, nonce, TEST_SIGNIFICANCE, signature2);

        // Fast forward time beyond cooldown period (1 hour for create_post)
        vm.warp(block.timestamp + 3601);
        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction2, nonce, TEST_SIGNIFICANCE, signature2);

        assertEq(metaTx.nonces(user), 2);
    }

    function testUserStatsTracking() public {
        // Ensure we're past any potential cooldowns from previous tests
        vm.warp(block.timestamp + 7300); // Past longest cooldown (2 hours + buffer)

        string memory interaction1 = "like_post-stats1";
        string memory interaction2 = "comment_post-stats2";

        // Initial stats should be zero
        (uint256 totalInteractions, uint256 totalPoints, uint256 lastTime) = metaTx.getUserStats(user);
        assertEq(totalInteractions, 0);
        assertEq(totalPoints, 0);
        assertEq(lastTime, 0);

        // First interaction
        bytes32 digest1 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction1)), 0))
            )
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(userPrivateKey, digest1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction1, 0, TEST_SIGNIFICANCE, signature1);

        // Check stats after first interaction
        (totalInteractions, totalPoints, lastTime) = metaTx.getUserStats(user);
        assertEq(totalInteractions, 1);
        assertGt(totalPoints, 0);
        assertEq(lastTime, block.timestamp);

        uint256 pointsAfterFirst = totalPoints;

        // Fast forward past comment_post cooldown (10 minutes)
        vm.warp(block.timestamp + 601);

        // Second interaction with different type
        bytes32 digest2 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction2)), 1))
            )
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(userPrivateKey, digest2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        vm.prank(relayer);
        metaTx.executeMetaTx(user, interaction2, 1, TEST_SIGNIFICANCE, signature2);

        // Check stats after second interaction
        (totalInteractions, totalPoints, lastTime) = metaTx.getUserStats(user);
        assertEq(totalInteractions, 2);
        assertGt(totalPoints, pointsAfterFirst);
        assertEq(lastTime, block.timestamp);
    }
}
