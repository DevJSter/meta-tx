// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./QoneqtSmartWallet.sol";

contract QoneqtWalletFactory {
    address public immutable implementation;

    event WalletCreated(address indexed wallet, address indexed owner, string socialId);

    constructor(address _implementation){
        implementation = _implementation;
    }

    function createWallet(address owner, string memory socialId, uint256 salt) external returns(address wallet) {
        bytes32 saltHash = keccack256(abi.encodePacked(socialId,salt));
        wallet = Clones.cloneDeterministic(implementation, saltHash);
        QoneqtSmartWallet(wallet).initialize(owner, owner);
        emit WalletCreated(wallet, owner, socialId);
    }

    function predictWalletAddress(string memory socialId, uint256 salt) external view returns (address predicted) {
        bytes32 saltHash = keccack256(abi.encodePacked(socialId, salt));
        predicted = Clones.predictDeterministicAddress(implementation, saltHash, address(this));
    }
}