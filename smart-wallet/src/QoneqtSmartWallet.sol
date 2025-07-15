// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

interface IQoneqtSessionManager {
    isSessionKeyValid(address wallet, address sessionKey, bytes calldata data) external view returns (bool);
}

contract QoneqtSmartWallet is ERC2771Context {
    address public owner;
    IQoneqtSessionManager public sessionManager;

    bool private initialized;

    event UserActionExecuted(address indexed user, string action);

    constructor(address forwarder) ERC2771Context(forwarder) {}

    function initialize(address _owner, address _sessionManager) external {
        require(!initialized, "Already initialized");
        owner = _owner;
        sessionManager = IQoneqtSessionManager(_sessionManager);
        initialized = true;
    }

    

    function executeUserAction(string memory action) external {
        // owner and sessionKey can call this 
        address sender = _msgSender();
        

        if (sender == owner) {

            //owner can do actions
            emit UserActionExecuted(sender, action);
            return;
        }

        //check sessionkey via sessionManager for validity and limits
        require(
            sessionManager.isSessionKeyValid(address(this), sender, abi.encode(action)),
            "Session key invalid or not authorized"
        );

        emit UserActionExecuted(sender, action);
    }

    function executeUserAction(string memory action, uint256 amount, address payable to) external {
        address sender = _msgSender();

        if(sender == owner) {
            _spend(to, amount);
            emit UserActionExecuted(sender, action, amount);
            return;
        }

        require(
            sessionManager.isSessionKeyValid(address(this), sender, abi.encode(action, amount, to)),
            "Session key invalid or not authorized"
        );

        //balance check
        require(address(this).balance >= amount, "Insufficient wallet balance");

        _spend(to, amount);
        emit UserActionExecuted(sender, action, amount);
    }

    function _spend(address payable to, uint256 amount) internal {
        require(to != address(0), "Invalid Recipient");
        (bool, success, ) = to.call{value: amount}{""};
        require(success, "Transfer failed");
    }

    //Allow contract to receive AVAX
    receive() external payable{}

}