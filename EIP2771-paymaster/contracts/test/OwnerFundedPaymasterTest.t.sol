// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "./EIP2771ForwarderTestHelper.sol";
import "../src/OwnerFundedPaymaster.sol";
import "../src/SampleContract.sol";
import "../src/interfaces/IEIP2771Forwarder.sol";

contract OwnerFundedPaymasterTest is Test {
    EIP2771ForwarderTestHelper forwarder;
    OwnerFundedPaymaster paymaster;
    SampleERC2771Contract sampleContract;
    
    address public owner;
    address public user1;
    address public relayer;
    
    uint256 constant USER1_PRIVATE_KEY = 0x1;
    
    function setUp() public {
        owner = makeAddr("owner");
        user1 = vm.addr(USER1_PRIVATE_KEY);
        relayer = makeAddr("relayer");
        
        // Fund the owner and user accounts
        vm.deal(owner, 10 ether);
        vm.deal(user1, 1 ether);
        vm.deal(relayer, 1 ether);
        
        vm.startPrank(owner);
        
        // Deploy contracts
        forwarder = new EIP2771ForwarderTestHelper(owner);
        paymaster = new OwnerFundedPaymaster(address(forwarder), owner);
        sampleContract = new SampleERC2771Contract(address(forwarder), owner);
        
        // Set up relationships
        forwarder.addTrustedPaymaster(address(paymaster));
        paymaster.setSponsoredContract(address(sampleContract), true);
        
        vm.stopPrank();
    }
    
    function signForwardRequest(
        IEIP2771Forwarder.ForwardRequest memory req,
        uint256 privateKey
    ) internal view returns (bytes memory) {
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
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
    
    function testOwnerFunding() public {
        // Owner deposits funds
        vm.prank(owner);
        paymaster.ownerDeposit{value: 0.1 ether}();
        
        assertEq(paymaster.getBalance(), 0.1 ether);
        assertTrue(paymaster.ownerFunded());
    }
    
    function testOwnerSponsoredTransaction() public {
        vm.txGasPrice(1 gwei);
        
        // Owner deposits funds
        vm.prank(owner);
        paymaster.ownerDeposit{value: 0.1 ether}();
        
        // Create forward request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);
        
        // Check if transaction can be afforded
        assertTrue(paymaster.canAffordTransaction(user1, req.gas));
        
        // Execute sponsored transaction (relayer calls paymaster, paymaster calls forwarder)
        vm.prank(relayer);
        (bool success,) = paymaster.sponsorTransaction(req, signature);
        
        assertTrue(success);
        
        // Verify the transaction worked
        assertEq(sampleContract.getBalance(user1), 100);
    }
    
    function testCannotSponsorWithoutFunds() public {
        // Don't deposit any funds
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });
        
        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);
        
        // Should not be able to afford transaction
        assertFalse(paymaster.canAffordTransaction(user1, req.gas));
        
        // Should fail to sponsor when paymaster tries to execute
        vm.prank(relayer);
        vm.expectRevert("Paymaster: insufficient funds");
        paymaster.sponsorTransaction(req, signature);
    }
    
    function testToggleOwnerFunding() public {
        vm.startPrank(owner);
        
        // Disable owner funding
        paymaster.setOwnerFunded(false);
        assertFalse(paymaster.ownerFunded());
        
        // Enable user contributions
        paymaster.setUserContributions(true);
        assertTrue(paymaster.allowUserContributions());
        
        vm.stopPrank();
    }
    
    function testUserContributions() public {
        vm.startPrank(owner);
        paymaster.setUserContributions(true);
        vm.stopPrank();
        
        // User deposits credits
        vm.prank(user1);
        paymaster.depositCredits{value: 0.05 ether}(user1);
        
        assertEq(paymaster.userCredits(user1), 0.05 ether);
        
        // User withdraws credits
        vm.prank(user1);
        paymaster.withdrawCredits(0.02 ether);
        
        assertEq(paymaster.userCredits(user1), 0.03 ether);
    }
    
    function testEmergencyWithdraw() public {
        // Owner deposits funds
        vm.prank(owner);
        paymaster.ownerDeposit{value: 0.1 ether}();
        
        uint256 ownerBalanceBefore = owner.balance;
        
        // Emergency withdraw
        vm.prank(owner);
        paymaster.emergencyWithdraw();
        
        assertEq(owner.balance, ownerBalanceBefore + 0.1 ether);
        assertEq(paymaster.getBalance(), 0);
    }
}
