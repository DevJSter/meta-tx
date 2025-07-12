// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Forwarder.sol";
import "../src/SampleContract.sol";

contract ForwarderTest is Test {
    MinimalForwarder public forwarder;
    SampleERC2771Contract public sampleContract;
    
    address public owner;
    address public user1;
    address public user2;
    address public relayer;
    
    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        relayer = makeAddr("relayer");
        
        vm.startPrank(owner);
        forwarder = new MinimalForwarder();
        sampleContract = new SampleERC2771Contract(address(forwarder));
        vm.stopPrank();
    }
    
    function testDeployment() public {
        assertEq(forwarder.owner(), owner);
        assertEq(forwarder.getNonce(user1), 0);
        assertTrue(forwarder.isTrustedForwarder(address(forwarder)));
    }
    
    function testGetNonce() public {
        assertEq(forwarder.getNonce(user1), 0);
        assertEq(forwarder.getNonce(user2), 0);
    }
    
    function testVerifySignature() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Create signature
        bytes32 digest = forwarder._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest); // user1 private key
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Verify signature
        assertTrue(forwarder.verify(req, signature));
    }
    
    function testExecuteForwardRequest() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Create signature
        bytes32 digest = forwarder._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Execute forward request
        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        
        assertTrue(success);
        assertEq(sampleContract.getBalance(user1), 100);
        assertEq(forwarder.getNonce(user1), 1);
    }
    
    function testExecuteWithMessage() public {
        string memory message = "Hello, World!";
        
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.setMessage.selector, message)
        });
        
        // Create signature
        bytes32 digest = forwarder._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Execute forward request
        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        
        assertTrue(success);
        assertEq(sampleContract.getMessage(user1), message);
    }
    
    function testCannotExecuteWithWrongSignature() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Create signature for different user
        bytes32 digest = forwarder._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(2, digest); // user2 private key
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Try to execute - should fail
        vm.prank(relayer);
        vm.expectRevert("MinimalForwarder: signature does not match request");
        forwarder.execute(req, signature);
    }
    
    function testCannotExecuteWithWrongNonce() public {
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1) + 1, // Wrong nonce
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Create signature
        bytes32 digest = forwarder._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Try to execute - should fail
        vm.prank(relayer);
        vm.expectRevert("MinimalForwarder: signature does not match request");
        forwarder.execute(req, signature);
    }
    
    function testTrustedPaymaster() public {
        address paymaster = makeAddr("paymaster");
        
        // Add trusted paymaster
        vm.prank(owner);
        forwarder.addTrustedPaymaster(paymaster);
        
        assertTrue(forwarder.trustedPaymasters(paymaster));
        
        // Remove trusted paymaster
        vm.prank(owner);
        forwarder.removeTrustedPaymaster(paymaster);
        
        assertFalse(forwarder.trustedPaymasters(paymaster));
    }
    
    function testOnlyOwnerCanAddPaymaster() public {
        address paymaster = makeAddr("paymaster");
        
        // Non-owner cannot add paymaster
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        forwarder.addTrustedPaymaster(paymaster);
    }
}