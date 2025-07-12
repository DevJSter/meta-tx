// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Forwarder.sol";
import "../src/Paymaster.sol";
import "../src/SampleContract.sol";

contract PaymasterTest is Test {
    MinimalForwarder public forwarder;
    Paymaster public paymaster;
    SampleERC2771Contract public sampleContract;
    
    address public owner;
    address public user1;
    address public user2;
    address public relayer;
    
    uint256 public constant INITIAL_BALANCE = 1 ether;
    
    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        relayer = makeAddr("relayer");
        
        vm.startPrank(owner);
        
        // Deploy contracts
        forwarder = new MinimalForwarder();
        paymaster = new Paymaster(address(forwarder));
        sampleContract = new SampleERC2771Contract(address(forwarder));
        
        // Set up relationships
        forwarder.addTrustedPaymaster(address(paymaster));
        paymaster.setSponsoredContract(address(sampleContract), true);
        
        vm.stopPrank();
        
        // Give users some ETH
        vm.deal(user1, INITIAL_BALANCE);
        vm.deal(user2, INITIAL_BALANCE);
        vm.deal(relayer, INITIAL_BALANCE);
    }
    
    function testDeployment() public {
        assertEq(forwarder.owner(), owner);
        assertEq(paymaster.owner(), owner);
        assertTrue(forwarder.trustedPaymasters(address(paymaster)));
        assertTrue(paymaster.sponsoredContracts(address(sampleContract)));
    }
    
    function testDepositCredits() public {
        uint256 depositAmount = 0.1 ether;
        
        vm.prank(user1);
        paymaster.depositCredits{value: depositAmount}(user1);
        
        assertEq(paymaster.userCredits(user1), depositAmount);
    }
    
    function testWithdrawCredits() public {
        uint256 depositAmount = 0.1 ether;
        uint256 withdrawAmount = 0.05 ether;
        
        // Deposit first
        vm.prank(user1);
        paymaster.depositCredits{value: depositAmount}(user1);
        
        // Withdraw
        vm.prank(user1);
        paymaster.withdrawCredits(withdrawAmount);
        
        assertEq(paymaster.userCredits(user1), depositAmount - withdrawAmount);
    }
    
    function testSponsorTransaction() public {
        // Deposit credits for user1
        vm.prank(user1);
        paymaster.depositCredits{value: 0.1 ether}(user1);
        
        // Create forward request
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Sign the request
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
        
        // Execute sponsored transaction
        vm.prank(relayer);
        paymaster.sponsorTransaction(req, signature);
        
        // Check if balance was updated
        assertEq(sampleContract.getBalance(user1), 100);
    }
    
    function testCannotSponsorUnsupportedContract() public {
        // Deploy another contract that's not sponsored
        SampleERC2771Contract unsponsoredContract = new SampleERC2771Contract(address(forwarder));
        
        // Deposit credits for user1
        vm.prank(user1);
        paymaster.depositCredits{value: 0.1 ether}(user1);
        
        // Create forward request for unsupported contract
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(unsponsoredContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Sign the request
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
        
        // Try to execute sponsored transaction - should fail
        vm.prank(relayer);
        vm.expectRevert("Paymaster: contract not sponsored");
        paymaster.sponsorTransaction(req, signature);
    }
    
    function testCannotSponsorWithInsufficientCredits() public {
        // Don't deposit credits for user1
        
        // Create forward request
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        // Sign the request
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
        
        // Try to execute sponsored transaction - should fail
        vm.prank(relayer);
        vm.expectRevert("Paymaster: insufficient credits");
        paymaster.sponsorTransaction(req, signature);
    }
    
    function testGetEstimatedFee() public {
        uint256 gasLimit = 100000;
        uint256 estimatedFee = paymaster.getEstimatedFee(gasLimit);
        
        // Should be gasLimit * tx.gasprice * feeMultiplier / 100
        uint256 expectedFee = (gasLimit * tx.gasprice * 120) / 100;
        assertEq(estimatedFee, expectedFee);
    }
    
    function testCanAffordTransaction() public {
        uint256 gasLimit = 100000;
        uint256 depositAmount = 0.1 ether;
        
        // User1 deposits credits
        vm.prank(user1);
        paymaster.depositCredits{value: depositAmount}(user1);
        
        // Check if user can afford transaction
        assertTrue(paymaster.canAffordTransaction(user1, gasLimit));
        
        // User2 has no credits
        assertFalse(paymaster.canAffordTransaction(user2, gasLimit));
    }
}