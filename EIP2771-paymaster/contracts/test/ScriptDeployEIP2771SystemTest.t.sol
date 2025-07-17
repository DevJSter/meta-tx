// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../script/DeployEIP2771System.s.sol";

contract ScriptDeployEIP2771SystemTest is Test {
    DeployEIP2771System script;

    function setUp() public {
        //deploy the script contract
        script = new DeployEIP2771System();
    }

    function testRun_ExecuteAllLines() public {
        script.run();
    }
}