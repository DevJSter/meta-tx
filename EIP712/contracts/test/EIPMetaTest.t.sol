// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EIPMetaTx.sol";
import "./ReentrancyAttacker.sol";

contract MetaTxInteractionTest is Test {
    MetaTxInteraction public metaTx;
    address public user;
    uint256 public userPrivateKey;

    function setUp() public {
        metaTx = new MetaTxInteraction();
        userPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        user = vm.addr(userPrivateKey);
    }

    function testExecuteMetaTx() public {
        string memory interaction = "liked_post";
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

        vm.expectEmit(true, false, false, true);
        emit MetaTxInteraction.InteractionPerformed(user, interaction);

        metaTx.executeMetaTx(user, interaction, nonce, signature);

        assertEq(metaTx.nonces(user), 1);
    }

    function testReplayAttackFails() public {
        string memory interaction = "liked_post";
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

        //First execution should pass
        metaTx.executeMetaTx(user, interaction, nonce, signature);

        //Nonce increment
        assertEq(metaTx.nonces(user), 1);

        //replay using same nonce should revert
        vm.expectRevert("Invalid nonce");
        metaTx.executeMetaTx(user, interaction, nonce, signature);
    }

    function testReentrancyAttackFails() public {
        // deploy attacker with the user private key and target contract address
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(metaTx), user);

        string memory interaction = "liked_post";
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

        // Perform the meta-tx via attacker; it should succeed exactly once
        attacker.attack(interaction, nonce, signature);

        // Confirm only one execution occurred
        assertEq(metaTx.nonces(user), 1);
    }

    function testInvalidSignatureFails() public {
        string memory interaction = "liked_post";
        uint256 nonce = 0;

        //random signature
        bytes memory invalidSignature = hex"1234";

        //any revert is valid for malformed sig
        vm.expectRevert();
        metaTx.executeMetaTx(user, interaction, nonce, invalidSignature);
    }

    function testIncorrectNonceFails() public {
        string memory interaction = "liked_post";
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
        metaTx.executeMetaTx(user, interaction, incorrectNonce, signature);
    }

    function testSequentialTransactions() public {
        string memory interaction1 = "liked_post";
        string memory interaction2 = "commented_post";

        //Transaction 1 (nonce 0)
        bytes32 digest1 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction1)), 0))
            )
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(userPrivateKey, digest1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);

        metaTx.executeMetaTx(user, interaction1, 0, signature1);
        assertEq(metaTx.nonces(user), 1);

        //transaction 2
        bytes32 digest2 = keccak256(
            abi.encodePacked(
                "\x19\x01",
                metaTx.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(metaTx.META_TX_TYPEHASH(), user, keccak256(bytes(interaction2)), 1))
            )
        );
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(userPrivateKey, digest2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        metaTx.executeMetaTx(user, interaction2, 1, signature2);
        assertEq(metaTx.nonces(user), 2);
    }
}
