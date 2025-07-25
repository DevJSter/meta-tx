// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BridgeReceiver is Ownable, ReentrancyGuard, ERC20("Wrapped QTOKEN", "QTOKEN.w") {
    address public bridgeEndpoint; // Corresponding bridge endpoint on Avalanche C-Chain

    event BridgeReceived(address indexed recipient, uint256 amount);

    constructor(address _bridgeEndpoint) Ownable(msg.sender) {
        bridgeEndpoint = _bridgeEndpoint;
    }

    function receiveBridgedQtoken(uint256 amount, address recipient) external nonReentrant {
        // Only callable by bridge endpoint (in production, add require(msg.sender == bridgeEndpoint))
        require(amount > 0, "Amount must be greater than 0");

        _mint(recipient, amount);
        emit BridgeReceived(recipient, amount);
    }

    // Function to bridge to subnet (Qoneqt P-Chain)
    function bridgeToSubnet(uint256 amount, address subnetRecipient) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient wrapped Qtoken");
        _burn(msg.sender, amount);

        // Placeholder for subnet transfer; integrate with Avalanche subnet tools
        // e.g., call subnetBridge.sendToSubnet(amount, subnetRecipient)
    }
}
