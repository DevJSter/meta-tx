// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EIP2771ForwarderTestContract
 * @dev Test helper contract for EIP2771 forwarder testing
 */
contract EIP2771ForwarderTestContract {
    address public trustedForwarder;
    uint256 public counter;
    mapping(address => uint256) public balances;
    
    event CounterIncremented(address indexed user, uint256 newValue);
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    constructor(address _trustedForwarder) {
        trustedForwarder = _trustedForwarder;
    }
    
    function incrementCounter() external {
        address sender = _msgSender();
        counter++;
        emit CounterIncremented(sender, counter);
    }
    
    function updateBalance(uint256 amount) external {
        address sender = _msgSender();
        balances[sender] = amount;
        emit BalanceUpdated(sender, amount);
    }
    
    function _msgSender() internal view returns (address) {
        if (msg.data.length >= 20 && msg.sender == trustedForwarder) {
            return address(bytes20(msg.data[msg.data.length - 20:]));
        }
        return msg.sender;
    }
    
    function _msgData() internal view returns (bytes calldata) {
        if (msg.data.length >= 20 && msg.sender == trustedForwarder) {
            return msg.data[:msg.data.length - 20];
        }
        return msg.data;
    }
}
