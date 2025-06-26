// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

contract MetaTxInteraction {
    using ECDSA for bytes32;

    event InteractionPerformed(address indexed user, string interaction);

    struct MetaTx {
        address user;
        string interaction;
        uint256 nonce;
    }

    bytes32 public constant META_TX_TYPEHASH = keccak256(
        "MetaTx(address user,string interaction,uint256 nonce)"
    );

    mapping(address => uint256) public nonces;
    bytes32 public DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("QoneqtMetaTx")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function executeMetaTx(
        address user,
        string calldata interaction,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(nonce == nonces[user], "Invalid nonce");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        META_TX_TYPEHASH,
                        user,
                        keccak256(bytes(interaction)),
                        nonce
                    )
                )
            )
        );

        address recovered = digest.recover(signature);
        require(recovered == user, "Invalid signature");

        nonces[user]++;

        emit InteractionPerformed(user, interaction);
    }
}
