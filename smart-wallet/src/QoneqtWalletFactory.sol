// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./QoneqtSmartWallet.sol";
import "./QoneqtSessionManager.sol";

contract QoneqtWalletFactory {
    address public immutable implementation;
    QoneqtSessionManager public sessionManager;

    event WalletCreated(address indexed wallet, address indexed owner, address sessionKey);

    constructor(address _implementation, address _sessionManager){
        implementation = _implementation;
        sessionManager = QoneqtSessionManager(_sessionManager);
    }

    //deploy wallet proxy
    function createWallet(address owner, string memory socialId, uint256 salt) external returns(address wallet, address sessionKey) {
        bytes32 saltHash = keccack256(abi.encodePacked(socialId,salt));
        wallet = Clones.cloneDeterministic(implementation, saltHash);

        //initialize wallet with onwer and sessionManager address
        QoneqtSmartWallet(wallet).initialize(owner, address(sessionManager));

        //generate a new session key with session manager - expiry set at 30 days from now for testing
        uint64 expiry = uint64(block.timestamp + 30 days);
        sessionManager.addSessionkey(wallet, sessionKey, expiry);

        emit WalletCreated(wallet, owner, sessionKey);
        
    }

    //predict wallet address without deploying

    function predictWalletAddress(string memory socialId, uint256 salt) external view returns (address predicted) {
        bytes32 saltHash = keccack256(abi.encodePacked(socialId, salt));
        predicted = Clones.predictDeterministicAddress(implementation, saltHash, address(this));
    }
}