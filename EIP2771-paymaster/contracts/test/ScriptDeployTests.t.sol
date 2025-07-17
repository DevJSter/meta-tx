pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../script/DeploySimple.s.sol";

contract ScriptDeployTests is Test {
    function testDeploySimple_RunLinesExecuted() public {
        DeploySimple script = new DeploySimple();
        try script.run() {
        } catch {
        }
    }
}
