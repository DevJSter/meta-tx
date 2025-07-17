// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../script/DeploySimplified.s.sol";

contract ScriptDeploySimplifiedTest is Test {
    function setUp() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.deal(deployer, 10 ether);
    }

    function testRun_ExecutesAllLines() public {
        DeploySimplified script = new DeploySimplified();
        script.run();
    }
}