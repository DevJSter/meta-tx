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

    function attack(string calldata interaction, uint256 nonce, uint256 significance, bytes calldata signature)
        external
    {
        // First call to executeMetaTx with significance parameter
        target.executeMetaTx(user, interaction, nonce, significance, signature);
    }

    fallback() external {
        // Try to reenter - this should fail due to reentrancy guard
        uint256 currentNonce = target.nonces(user);
        bytes memory dummySig = hex"00";
        uint256 dummySignificance = 100; // 1.0 significance
        try target.executeMetaTx(user, "reenter_attempt", currentNonce, dummySignificance, dummySig) {
            revert("Reentrancy succeeded unexpectedly");
        } catch {}
    }
}
