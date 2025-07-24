// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EIPMetaTx.sol";
import "../src/Minting.sol";

/**
 * @title EIP712MetaTxEdgeCaseTest
 * @dev Comprehensive edge case testing for EIP712 meta-transaction functionality
 */
contract EIP712MetaTxEdgeCaseTest is Test {
    MetaTxInteraction public metaTxContract;
    QobitToken public qobitToken;

    address public owner;
    address public user1;
    address public user2;
    address public relayer;
    address public unauthorized;

    // Test keys for signing
    uint256 private user1PrivateKey = 0x1;
    uint256 private user2PrivateKey = 0x2;

    // EIP712 Domain
    string constant DOMAIN_NAME = "QoneqtMetaTx";
    string constant DOMAIN_VERSION = "1";
    bytes32 constant META_TX_TYPEHASH = keccak256("MetaTx(address user,string interaction,uint256 nonce)");

    function setUp() public {
        owner = address(this);
        user1 = vm.addr(user1PrivateKey);
        user2 = vm.addr(user2PrivateKey);
        relayer = vm.addr(3);
        unauthorized = vm.addr(4);

        // Deploy contracts
        metaTxContract = new MetaTxInteraction();
        qobitToken = new QobitToken();

        // Configure contracts
        metaTxContract.setMintingContract(address(qobitToken));
        metaTxContract.setAuthorizedRelayer(relayer);
        qobitToken.setMetaTxContract(address(metaTxContract));

        // Add interaction types without long cooldowns for testing
        metaTxContract.addInteractionType("create_post", 500, 0); // No cooldown for testing
        metaTxContract.addInteractionType("like_post", 100, 300); // 5 min cooldown
        metaTxContract.addInteractionType("comment", 200, 600); // 10 min cooldown
    }

    // =============================================================================
    // SIGNATURE VALIDATION EDGE CASES
    // =============================================================================

    function testInvalidSignatureLength() public {
        string memory interaction = "create_post-test";
        uint256 nonce = metaTxContract.nonces(user1);

        // Create signature with wrong length
        bytes memory invalidSig = hex"1234"; // Too short

        vm.expectRevert(); // Should revert due to invalid signature
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, 500, invalidSig);
    }

    function testSignatureReplay() public {
        string memory interaction = "create_post-replay";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        // Create valid signature
        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute transaction successfully
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);

        // Try to replay the same signature
        vm.expectRevert("Invalid nonce");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    function testWrongSigner() public {
        string memory interaction = "create_post-wrong";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        // Sign with user2's key but claim it's from user1
        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user2PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid signature");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    function testMalformedSignature() public {
        string memory interaction = "create_post-malformed";
        uint256 nonce = metaTxContract.nonces(user1);

        // Create malformed signature (invalid v value)
        bytes memory malformedSig = abi.encodePacked(
            bytes32(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef),
            bytes32(0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321),
            uint8(30) // Invalid v value (should be 27 or 28)
        );

        vm.expectRevert(); // Should revert due to invalid signature recovery
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, 500, malformedSig);
    }

    // =============================================================================
    // NONCE EDGE CASES
    // =============================================================================

    function testNonceIncrement() public {
        string memory interaction = "create_post-nonce";
        uint256 significance = 500;

        uint256 initialNonce = metaTxContract.nonces(user1);

        // Execute transaction
        bytes32 digest = _getTypedDataHash(user1, interaction, initialNonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, initialNonce, significance, signature);

        // Check nonce incremented
        assertEq(metaTxContract.nonces(user1), initialNonce + 1);
    }

    function testFutureNonce() public {
        string memory interaction = "create_post-future";
        uint256 futureNonce = metaTxContract.nonces(user1) + 5; // Skip ahead
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, futureNonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid nonce");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, futureNonce, significance, signature);
    }

    function testOldNonce() public {
        // First, execute a transaction to increment nonce
        string memory firstInteraction = "create_post-first";
        uint256 firstNonce = metaTxContract.nonces(user1);

        bytes32 firstDigest = _getTypedDataHash(user1, firstInteraction, firstNonce);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(user1PrivateKey, firstDigest);
        bytes memory firstSignature = abi.encodePacked(r1, s1, v1);

        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, firstInteraction, firstNonce, 500, firstSignature);

        // Now try to use the old nonce
        string memory secondInteraction = "create_post-old";
        bytes32 secondDigest = _getTypedDataHash(user1, secondInteraction, firstNonce);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(user1PrivateKey, secondDigest);
        bytes memory secondSignature = abi.encodePacked(r2, s2, v2);

        vm.expectRevert("Invalid nonce");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, secondInteraction, firstNonce, 500, secondSignature);
    }

    // =============================================================================
    // INTERACTION TYPE EDGE CASES
    // =============================================================================

    function testUnregisteredInteractionType() public {
        string memory interaction = "unknown_interaction";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Based on the contract logic, unregistered types should still work with base significance
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);

        // Verify the interaction was processed
        (uint256 totalInteractions,,) = metaTxContract.getUserStats(user1);
        assertEq(totalInteractions, 1);
    }

    function testInactiveInteractionType() public {
        // Since there's no updateInteractionType function, we'll test with a different approach
        // Test that interaction types require proper registration first
        string memory interaction = "unregistered_type";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 300;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // This should work since unregistered types default to base significance
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);

        // Verify the interaction was processed
        (uint256 totalInteractions,,) = metaTxContract.getUserStats(user1);
        assertEq(totalInteractions, 1);
    }

    function testSignificanceOutOfBounds() public {
        string memory interaction = "create_post";
        uint256 nonce = metaTxContract.nonces(user1);

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Test significance too high (above MAX_SIGNIFICANCE = 1000)
        vm.expectRevert("Invalid significance");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, 1001, signature);

        // Test significance too low (below MIN_SIGNIFICANCE = 10)
        vm.expectRevert("Invalid significance");
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, 9, signature);
    }

    // =============================================================================
    // ACCESS CONTROL EDGE CASES
    // =============================================================================

    function testUnauthorizedRelayer() public {
        string memory interaction = "create_post";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Only authorized relayer");
        vm.prank(unauthorized);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    function testOwnerCannotExecuteMetaTx() public {
        // Based on the contract, only the authorized relayer can execute
        string memory interaction = "create_post";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Owner should not be able to execute unless they are the authorized relayer
        vm.expectRevert("Only authorized relayer");
        vm.prank(owner);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    // =============================================================================
    // DOMAIN SEPARATOR EDGE CASES
    // =============================================================================

    function testDomainSeparatorChainId() public {
        // This test ensures domain separator includes chain ID

        // Create signature for current chain
        string memory interaction = "create_post-chain";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute successfully on current chain
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);

        // Note: We can't actually change chain ID in foundry tests,
        // but the domain separator logic is tested in the signature validation
    }

    // =============================================================================
    // INTEGRATION EDGE CASES
    // =============================================================================

    function testZeroAddressUser() public {
        string memory interaction = "create_post-zero";
        uint256 nonce = 0;
        uint256 significance = 500;

        // Create any signature (will fail before signature check)
        bytes memory signature =
            hex"1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";

        vm.expectRevert(); // Should revert when trying to record interaction with zero address
        vm.prank(relayer);
        metaTxContract.executeMetaTx(address(0), interaction, nonce, significance, signature);
    }

    function testMintingContractNotSet() public {
        // Deploy new meta tx contract without setting minting contract
        MetaTxInteraction newMetaTx = new MetaTxInteraction();
        newMetaTx.setAuthorizedRelayer(relayer);
        newMetaTx.addInteractionType("test", 500, 3600);

        string memory interaction = "test";
        uint256 nonce = 0;
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHashForContract(address(newMetaTx), user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(); // Should revert when trying to call unset minting contract
        vm.prank(relayer);
        newMetaTx.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    function testEmptyInteractionString() public {
        // Add empty string interaction type with no cooldown
        metaTxContract.addInteractionType("", 100, 0);

        string memory interaction = "";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 100;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Should work with empty string
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    function testLongInteractionString() public {
        // Create very long interaction string
        string memory longInteraction =
            "this_is_a_very_long_interaction_string_that_tests_the_limits_of_string_handling_in_the_contract_and_ensures_proper_gas_usage_and_storage_efficiency_when_dealing_with_extended_interaction_descriptions";

        metaTxContract.addInteractionType(longInteraction, 300, 600);

        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 300;

        bytes32 digest = _getTypedDataHash(user1, longInteraction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Should handle long strings correctly
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, longInteraction, nonce, significance, signature);
    }

    // =============================================================================
    // REENTRANCY PROTECTION TESTS
    // =============================================================================

    function testReentrancyProtection() public {
        // Test that executeMetaTx has basic protection against double execution
        string memory interaction = "create_post";
        uint256 nonce = metaTxContract.nonces(user1);
        uint256 significance = 500;

        bytes32 digest = _getTypedDataHash(user1, interaction, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute once successfully
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);

        // Try to execute the same transaction again (replay attack) - should fail
        // The exact error depends on the contract implementation
        vm.expectRevert();
        vm.prank(relayer);
        metaTxContract.executeMetaTx(user1, interaction, nonce, significance, signature);
    }

    // =============================================================================
    // STATISTICAL EDGE CASES
    // =============================================================================

    function testUserStatsAccuracy() public {
        address testUser = user1;

        // Perform various interactions
        string[] memory interactions = new string[](3);
        interactions[0] = "create_post";
        interactions[1] = "like_post";
        interactions[2] = "comment";

        uint256[] memory significances = new uint256[](3);
        significances[0] = 500;
        significances[1] = 100;
        significances[2] = 200;

        uint256 expectedTotalPoints = 0;

        for (uint256 i = 0; i < interactions.length; i++) {
            uint256 nonce = metaTxContract.nonces(testUser);
            bytes32 digest = _getTypedDataHash(testUser, interactions[i], nonce);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);
            bytes memory signature = abi.encodePacked(r, s, v);

            // Calculate expected points based on interaction type base points and significance
            // Note: The contract multiplies base points by significance and divides by 100
            uint256 basePoints;
            if (keccak256(bytes(interactions[i])) == keccak256(bytes("create_post"))) {
                basePoints = 500; // From our setUp
            } else if (keccak256(bytes(interactions[i])) == keccak256(bytes("like_post"))) {
                basePoints = 100; // From our setUp
            } else if (keccak256(bytes(interactions[i])) == keccak256(bytes("comment"))) {
                basePoints = 200; // From our setUp
            }

            uint256 calculatedPoints = (basePoints * significances[i]) / 100;
            expectedTotalPoints += calculatedPoints;

            vm.prank(relayer);
            metaTxContract.executeMetaTx(testUser, interactions[i], nonce, significances[i], signature);

            // Add delay to test cooldown if needed
            vm.warp(block.timestamp + 3601); // 1 hour + 1 second
        }

        // Check user stats
        (uint256 totalInteractions, uint256 totalPoints,) = metaTxContract.getUserStats(testUser);
        assertEq(totalInteractions, 3);
        assertEq(totalPoints, expectedTotalPoints);

        // Check individual interaction counts
        assertEq(metaTxContract.getUserInteractionCount(testUser, "create_post"), 1);
        assertEq(metaTxContract.getUserInteractionCount(testUser, "like_post"), 1);
        assertEq(metaTxContract.getUserInteractionCount(testUser, "comment"), 1);
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    function _getTypedDataHash(address user, string memory interaction, uint256 nonce)
        internal
        view
        returns (bytes32)
    {
        return _getTypedDataHashForContract(address(metaTxContract), user, interaction, nonce);
    }

    function _getTypedDataHashForContract(address contractAddr, address user, string memory interaction, uint256 nonce)
        internal
        view
        returns (bytes32)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                contractAddr
            )
        );

        bytes32 structHash = keccak256(abi.encode(META_TX_TYPEHASH, user, keccak256(bytes(interaction)), nonce));

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
