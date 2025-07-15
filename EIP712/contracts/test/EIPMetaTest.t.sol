// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EIPMetaTx.sol";

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
}
