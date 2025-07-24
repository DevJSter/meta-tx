// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SubnetReceiver is Ownable, ERC20("Subnet Wrapped QTOKEN", "sQTOKEN.w") {
    address public cChainBridge; // Address of C-Chain bridge receiver

    event SubnetReceived(address indexed recipient, uint256 amount);

    constructor(address _cChainBridge) Ownable(msg.sender) {
        cChainBridge = _cChainBridge;
    }

    function receiveFromCChain(uint256 amount, address recipient) external {
        // Only callable by C-Chain bridge (require(msg.sender == cChainBridge))
        require(amount > 0, "Amount must be greater than 0");

        _mint(recipient, amount);
        emit SubnetReceived(recipient, amount);
    }
}
