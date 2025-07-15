// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/QoneqtSmartWallet.sol";


contract SmartWallet is Test {
    QoneqtSmartWallet wallet;

    event UserActionExecuted(address indexed user, string action);

    function setUp() public {
        //dummy forwarder for now 
        address dummyForwarder =  address(0x1234);
        wallet = new QoneqtSmartWallet(dummyForwarder);

        wallet.initialize(address(this), address(this));
    }

    function testDeployment() public {
        assert(address(wallet) != address(0));
    }

    function testExecuteUserAction() public {

        string memory action = "test_action";
        vm.expectEmit(true, false, false, true);
        emit UserActionExecuted(address(this), action);


        wallet.executeUserAction(action);

    }
}