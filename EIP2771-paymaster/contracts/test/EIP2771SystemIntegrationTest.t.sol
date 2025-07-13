// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/EIP2771Forwarder.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/OwnerFundedPaymaster.sol";
import "../src/EIP2771ForwarderTestContract.sol";
import "../src/interfaces/IEIP2771Forwarder.sol";
import "./EIP2771ForwarderTestHelper.sol";

/**
 * @title EIP2771SystemIntegrationTest
 * @dev Comprehensive integration test for the EIP2771 system
 */
contract EIP2771SystemIntegrationTest is Test {
    EIP2771ForwarderTestHelper public forwarder;
    MetaTransactionPaymaster public paymaster;
    OwnerFundedPaymaster public ownerPaymaster;
    EIP2771ForwarderTestContract public testContract;
    
    address public owner = address(0x123);
    address public user;
    address public relayer = address(0x789);
    
    uint256 public userPrivateKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Derive user address from private key
        user = vm.addr(userPrivateKey);
        
        // Deploy contracts
        forwarder = new EIP2771ForwarderTestHelper(owner);
        paymaster = new MetaTransactionPaymaster(address(forwarder), owner);
        ownerPaymaster = new OwnerFundedPaymaster(address(forwarder), owner);
        testContract = new EIP2771ForwarderTestContract(address(forwarder));
        
        // Configure system
        forwarder.addTrustedPaymaster(address(paymaster));
        forwarder.addTrustedPaymaster(address(ownerPaymaster));
        
        paymaster.setSponsoredContract(address(testContract), true);
        ownerPaymaster.setSponsoredContract(address(testContract), true);
        
        vm.stopPrank();
        
        // Fund accounts
        vm.deal(owner, 10 ether);
        vm.deal(user, 1 ether);
        vm.deal(relayer, 1 ether);
    }
    
    function testDirectMetaTransactionExecution() public {
        // Test direct meta-transaction execution
        bytes memory data = abi.encodeWithSignature("incrementCounter()");
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user,
            to: address(testContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user),
            data: data
        });
        
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        assertTrue(success);
        assertEq(testContract.counter(), 1);
    }
    
    function testSponsoredTransactionWithPaymaster() public {
        // Deposit credits to paymaster
        vm.prank(user);
        paymaster.depositCredits{value: 0.1 ether}(user);
        
        // Test sponsored transaction
        bytes memory data = abi.encodeWithSignature("incrementCounter()");
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user,
            to: address(testContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user),
            data: data
        });
        
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
        
        assertTrue(success);
        assertEq(testContract.counter(), 1);
    }
    
    function testOwnerFundedPaymaster() public {
        // Fund owner paymaster
        vm.prank(owner);
        ownerPaymaster.ownerDeposit{value: 0.1 ether}();
        
        // Test owner-funded transaction
        bytes memory data = abi.encodeWithSignature("incrementCounter()");
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user,
            to: address(testContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user),
            data: data
        });
        
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(ownerPaymaster));
        
        assertTrue(success);
        assertEq(testContract.counter(), 1);
    }
    
    function _getDigest(IEIP2771Forwarder.ForwardRequest memory req) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                forwarder.exposedDomainSeparatorV4(),
                structHash
            )
        );
        
        return digest;
    }
}
