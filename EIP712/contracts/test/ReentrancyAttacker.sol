// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/EIPMetaTx.sol";

contract ReentrancyAttacker {
    MetaTxInteraction public target;
    address public user;

    // Pass user address instead of private key
    constructor(address _target, address _user) {
        target = MetaTxInteraction(_target);
        user = _user;
    }

    function attack(string calldata interaction, uint256 nonce, bytes calldata signature) external {
        // First call to executeMetaTx
        target.executeMetaTx(user, interaction, nonce, signature);
    }

    fallback() external {
        // Try to reenter - this should fail or be impossible as no external calls exist
        uint256 currentNonce = target.nonces(user);
        bytes memory dummySig = hex"00";
        try target.executeMetaTx(user, "reenter_attempt", currentNonce, dummySig) {
            revert("Reentrancy succeeded unexpectedly");
        } catch {}
    }
}
