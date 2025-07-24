// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BridgeSender is Ownable, ReentrancyGuard {
    IERC20 public qtoken;
    address public bridgeEndpoint; // Address of cross-chain bridge endpoint (e.g., LayerZero or Avalanche Teleporter)

    event BridgeInitiated(address indexed sender, uint256 amount, address recipient, uint256 nonce);

    constructor(address _qtoken, address _bridgeEndpoint) Ownable(msg.sender) {
        qtoken = IERC20(_qtoken);
        bridgeEndpoint = _bridgeEndpoint;
    }

    function bridgeQtoken(uint256 amount, address recipient) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(qtoken.balanceOf(msg.sender) >= amount, "Insufficient Qtoken balance");
        require(qtoken.allowance(msg.sender, address(this)) >= amount, "Approve Qtoken first");

        require(qtoken.transferFrom(msg.sender, address(this), amount), "Qtoken transfer failed");

        // Simulate/initiate cross-chain call to Avalanche C-Chain
        // In production, integrate with bridge SDK (e.g., call bridgeEndpoint.send(amount, recipient))
        uint256 nonce = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        emit BridgeInitiated(msg.sender, amount, recipient, nonce);

        // Placeholder for actual bridge call; revert on failure
        // if (!bridgeEndpoint.call(abi.encodeWithSignature("sendToAvalanche(uint256,address)", amount, recipient))) {
        //     revert("Bridge failed");
        // }
    }
}
