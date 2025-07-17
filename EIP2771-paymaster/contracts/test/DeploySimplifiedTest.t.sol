// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../script/DeploySimplified.s.sol";

contract ScriptDeploySimplifiedTest is Test {
    function setUp() public {
        // Pull in the private key from the environment
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Give that deployer enough ETH to cover all the broadcasted txs
        vm.deal(deployer, 10 ether);
    }

    function testRun_ExecutesAllLines() public {
        // Instantiate and run the script under test
        DeploySimplified script = new DeploySimplified();
        script.run();
    }
}
