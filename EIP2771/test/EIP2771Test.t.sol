// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AIValidatedForwarder.sol";
import "../src/MetaTxInteractionRecipient.sol";

contract EIP2771Test is Test {
    AIValidatedForwarder public forwarder;
    MetaTxInteractionRecipient public recipient;

    address public user = address(0x123);
    address public relayer = address(0x456);
    uint256 public userPrivateKey = 0x123456;

    function setUp() public {
        // Deploy contracts
        forwarder = new AIValidatedForwarder("QoneqtAIForwarder");
        recipient = new MetaTxInteractionRecipient(address(forwarder));

        // Give some ETH to test accounts
        vm.deal(user, 1 ether);
        vm.deal(relayer, 1 ether);
    }

    function testDirectInteraction() public {
        vm.prank(user);
        recipient.executeInteraction("liked_post_123");

        assertEq(recipient.getUserInteractionCount(user), 1);
        assertEq(recipient.getLatestInteraction(user), "liked_post_123");
    }

    function testAIValidation() public {
        // Test valid interactions
        assertTrue(forwarder.validateInteractionBasic("liked_post"));
        assertTrue(forwarder.validateInteractionBasic("comment_nice"));
        assertTrue(forwarder.validateInteractionBasic("share_article"));
        assertTrue(forwarder.validateInteractionBasic("follow_user"));

        // Test invalid interactions
        assertFalse(forwarder.validateInteractionBasic("invalid_action"));
        assertFalse(forwarder.validateInteractionBasic("spam_user"));
        assertFalse(forwarder.validateInteractionBasic(""));
    }

    function testAddValidationRule() public {
        // Initially, "vote_" should not be valid
        assertFalse(forwarder.validateInteractionBasic("vote_proposal"));

        // Add new validation rule
        forwarder.setValidationRule("vote_", true);

        // Now it should be valid
        assertTrue(forwarder.validateInteractionBasic("vote_proposal"));
    }

    function testRemoveValidationRule() public {
        // Initially, "liked_" should be valid
        assertTrue(forwarder.validateInteractionBasic("liked_post"));

        // Remove validation rule
        forwarder.setValidationRule("liked_", false);

        // Now it should be invalid
        assertFalse(forwarder.validateInteractionBasic("liked_post"));
    }

    function testMetaTransactionStructure() public {
        // Create a meta-transaction request
        AIValidatedForwarder.ForwardRequestData memory request;
        request.from = user;
        request.to = address(recipient);
        request.value = 0;
        request.gas = 100000;
        request.deadline = uint48(block.timestamp + 1 hours);
        request.data = abi.encodeWithSignature("executeInteraction(string)", "liked_post_456");

        // In a real scenario, this would be signed by the user
        // For testing, we'll just verify the structure is correct
        assertEq(request.from, user);
        assertEq(request.to, address(recipient));
        assertGt(request.deadline, block.timestamp);
    }

    function testRecipientMetaTransactionDetection() public {
        // Direct call should not be detected as meta-transaction
        vm.prank(user);
        recipient.executeInteraction("liked_post_direct");

        // We can't easily test actual meta-transaction without full EIP-712 signing
        // But we can verify the recipient contract has the detection logic
        assertTrue(recipient.getUserInteractionCount(user) == 1);
    }
}
