// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importing ERC20 from OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRChainBridge {
    function mintQobitsOnRChain(address user, uint256 amount) external;
}

contract CChainQobitLock {
    address public rChainBridge;
    address public qobitToken;

    mapping(address => uint256) public lockedQobits;
    mapping(address => uint256) public qobitsLockTimestamp;

    event QobitsLocked(address indexed user, uint256 amount);
    event QobitsBridged(address indexed user, uint256 amount);

    constructor(address _rChainBridge, address _qobitToken) {
        rChainBridge = _rChainBridge;
        qobitToken = _qobitToken;
    }

    function lockQobits(address user, uint256 amount) internal {
        lockedQobits[user] += amount;
        qobitsLockTimestamp[user] = block.timestamp; // Lock for 24 hours
        emit QobitsLocked(user, amount);
    }

    // Lock Qobits after interaction
    function lockTokensForInteraction(address user, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(qobitToken).transferFrom(user, address(this), amount); // Use IERC20 interface for token transfer
        lockQobits(user, amount);
    }

    // Bridge Qobits from C-Chain to R-Chain
    function bridgeQobitsToRChain(address user, uint256 amount) external {
        require(lockedQobits[user] >= amount, "Insufficient locked Qobits");
        require(block.timestamp >= qobitsLockTimestamp[user] + 24 hours, "Qobits are still locked");

        IRChainBridge(rChainBridge).mintQobitsOnRChain(user, amount);

        lockedQobits[user] -= amount;
        emit QobitsBridged(user, amount);
    }
}
