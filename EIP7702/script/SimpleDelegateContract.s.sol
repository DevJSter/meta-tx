// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
 
import "forge-std/Script.sol";
import "forge-std/Vm.sol";
import "../src/SimpleDelegateContract.sol";
// import "../src/ERC20.sol";

contract SignDelegationScript is Script {
    // Alice's address and private key (EOA with no initial contract code).
    address payable ALICE_ADDRESS = payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    uint256 constant ALICE_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
 
    // Bob's address and private key (Bob will execute transactions on Alice's behalf).
    address constant BOB_ADDRESS = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 constant BOB_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
 
    // Deployer's address and private key (used to deploy contracts).
    address private constant DEPLOYER_ADDRESS = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;
    uint256 private constant DEPLOYER_PK = 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6;
 
    // The contract that Alice will delegate execution to.
    SimpleDelegateContract public implementation;
 
    // ERC-20 token contract for minting test tokens.
    ERC20 public token;
 
    function run() external {
        // Step 1: Deploy delegation and ERC-20 contracts using the Deployer's key.
        vm.broadcast(DEPLOYER_PK);
        implementation = new SimpleDelegateContract();
        token = new ERC20(ALICE_ADDRESS);
 
        // Construct a single transaction call: Mint 100 tokens to Bob.
        SimpleDelegateContract.Call[] memory calls = new SimpleDelegateContract.Call[](1);
        bytes memory data = abi.encodeCall(ERC20.mint, (100, BOB_ADDRESS));
        calls[0] = SimpleDelegateContract.Call({to: address(token), data: data, value: 0});
 
        // Alice signs a delegation allowing `implementation` to execute transactions on her behalf.
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);
 
        // Bob attaches the signed delegation from Alice and broadcasts it.
        vm.broadcast(BOB_PK);
        vm.attachDelegation(signedDelegation);
 
        // As Bob, execute the transaction via Alice's assigned contract.
        SimpleDelegateContract(ALICE_ADDRESS).execute(calls);
 
        // Verify balance
        vm.assertEq(token.balanceOf(BOB_ADDRESS), 100);
    }
}