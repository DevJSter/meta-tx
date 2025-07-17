// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}

contract RChainQobitSwap {
    address public qobitToken;
    address public cChainContract;

    mapping(address => uint256) public qobitsBalance;

    event QobitsMinted(address indexed user, uint256 amount);
    event QobitSwappedForQToken(address indexed user, uint256 amount);

    constructor(address _qobitToken, address _cChainContract) {
        qobitToken = _qobitToken;
        cChainContract = _cChainContract;
    }

    // Added setter to resolve deployment circularity (add onlyOwner modifier if needed)
    function setCChainContract(address _cChainContract) external {
        cChainContract = _cChainContract;
    }

    function mintQobitsOnRChain(address user, uint256 amount) external {
        require(msg.sender == cChainContract, "Only C-Chain contract can mint Qobits");

        ERC20(qobitToken).mint(address(this), amount); // Fixed: Mint to contract, not user
        qobitsBalance[user] += amount;
        emit QobitsMinted(user, amount);
    }

    function swapQobitsForQToken(address user, uint256 qobitsAmount) external {
        require(qobitsBalance[user] >= qobitsAmount, "Insufficient Qobits");

        ERC20(qobitToken).transfer(user, qobitsAmount); // Transfer from contract to user

        qobitsBalance[user] -= qobitsAmount;

        emit QobitSwappedForQToken(user, qobitsAmount);
    }
}
