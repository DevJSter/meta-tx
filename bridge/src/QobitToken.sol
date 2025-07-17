// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract QobitToken is ERC20 {
    constructor() ERC20("Qobit", "QBT") {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // Initial supply for testing
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount); // Open for testing; add access control in production
    }
}
