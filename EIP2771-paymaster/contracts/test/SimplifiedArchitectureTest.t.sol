// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "./EIP2771ForwarderTestHelper.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/SampleContract.sol";
import "../src/interfaces/IEIP2771Forwarder.sol";

contract SimplifiedArchitectureTest is Test {
    EIP2771ForwarderTestHelper forwarder;
    MetaTransactionPaymaster paymaster;
    SampleERC2771Contract sampleContract;

    address public owner;
    address public user1;
    address public user2;
    address public anyone; // Represents anyone who can call the forwarder

    uint256 constant USER1_PRIVATE_KEY = 0x1;
    uint256 constant USER2_PRIVATE_KEY = 0x2;

    function setUp() public {
        owner = makeAddr("owner");
        user1 = vm.addr(USER1_PRIVATE_KEY);
        user2 = vm.addr(USER2_PRIVATE_KEY);
        anyone = makeAddr("anyone");

        // Fund all accounts
        vm.deal(owner, 10 ether);
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
        vm.deal(anyone, 1 ether);

        vm.startPrank(owner);

        // Deploy contracts
        forwarder = new EIP2771ForwarderTestHelper(owner);
        paymaster = new MetaTransactionPaymaster(address(forwarder), owner);
        sampleContract = new SampleERC2771Contract(address(forwarder), owner);

        // Setup relationships
        forwarder.addTrustedPaymaster(address(paymaster));
        paymaster.setSponsoredContract(address(sampleContract), true);

        vm.stopPrank();
    }

    function signForwardRequest(IEIP2771Forwarder.ForwardRequest memory req, uint256 privateKey)
        internal
        view
        returns (bytes memory)
    {
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

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", forwarder.exposedDomainSeparatorV4(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function testOwnerFundsPaymaster() public {
        // Owner funds the paymaster
        vm.prank(owner);
        paymaster.depositCredits{value: 2 ether}(owner);

        assertEq(address(paymaster).balance, 2 ether);
    }

    function testSponsoredTransactionWithoutRelayer() public {
        // Fund paymaster - deposit credits for user1
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        // Create forward request from user1
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // Check that paymaster can sponsor
        assertTrue(paymaster.canSponsorTransaction(user1, req.to, req.gas));

        // Anyone can execute the transaction through the forwarder with paymaster sponsorship
        vm.prank(anyone);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));

        assertTrue(success);
        assertEq(sampleContract.getBalance(user1), 100);
    }

    function testUnsponsoredTransactionStillWorks() public {
        // Don't fund paymaster or sponsor the contract
        vm.prank(owner);
        paymaster.setSponsoredContract(address(sampleContract), false);

        // Create forward request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 50)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // Check that paymaster cannot sponsor
        assertFalse(paymaster.canSponsorTransaction(user1, req.to, req.gas));

        // User pays for their own gas through executeMetaTransaction
        vm.prank(anyone);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);

        assertTrue(success);
        assertEq(sampleContract.getBalance(user1), 50);
    }

    function testExecuteOnlyIfSponsored() public {
        // Fund paymaster - deposit credits for user1
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        // Create forward request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 75)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // This should work since paymaster sponsors it through executeSponsoredTransaction
        vm.prank(anyone);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));

        assertTrue(success);
        assertEq(sampleContract.getBalance(user1), 75);
    }

    function testExecuteOnlyIfSponsoredFailsWhenNotSponsored() public {
        // Don't fund paymaster

        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 25)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // This should fail since paymaster cannot sponsor (using executeSponsoredTransaction)
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: transaction cannot be sponsored");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }

    function testMultipleUsersCanUseSponsorship() public {
        // Fund paymaster - deposit credits for both users
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        vm.prank(user2);
        paymaster.depositCredits{value: 1 ether}(user2);

        // User1 transaction
        IEIP2771Forwarder.ForwardRequest memory req1 = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 200)
        });

        // User2 transaction
        IEIP2771Forwarder.ForwardRequest memory req2 = IEIP2771Forwarder.ForwardRequest({
            from: user2,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user2),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 300)
        });

        bytes memory signature1 = signForwardRequest(req1, USER1_PRIVATE_KEY);
        bytes memory signature2 = signForwardRequest(req2, USER2_PRIVATE_KEY);

        // Both transactions are sponsored through executeSponsoredTransaction
        vm.prank(anyone);
        (bool success1,) = forwarder.executeSponsoredTransaction(req1, signature1, address(paymaster));

        vm.prank(anyone);
        (bool success2,) = forwarder.executeSponsoredTransaction(req2, signature2, address(paymaster));

        assertTrue(success1);
        assertTrue(success2);
        assertEq(sampleContract.getBalance(user1), 200);
        assertEq(sampleContract.getBalance(user2), 300);
    }

    function testOwnerCanWithdrawFunds() public {
        // Fund paymaster
        vm.prank(owner);
        paymaster.depositCredits{value: 1 ether}(owner);

        uint256 ownerBalanceBefore = owner.balance;

        // Owner withdraws
        vm.prank(owner);
        paymaster.emergencyWithdraw();

        assertEq(address(paymaster).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + 1 ether);
    }

    // ============ Additional Edge Cases and Security Tests ============

    function testReplayAttackPrevention() public {
        // Fund paymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

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

        // First execution should succeed
        vm.prank(anyone);
        (bool success1,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
        assertTrue(success1);

        // Second execution with same signature should fail due to nonce increment
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }

    function testInvalidSignatureRejection() public {
        // Fund paymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        // Create forward request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        // Sign with wrong private key
        bytes memory invalidSignature = signForwardRequest(req, USER2_PRIVATE_KEY);

        // Should fail
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeSponsoredTransaction(req, invalidSignature, address(paymaster));
    }

    function testWrongNonceRejection() public {
        // Fund paymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        // Create forward request with wrong nonce
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1) + 1, // Wrong nonce
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // Should fail
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }

    function testUntrustedPaymasterRejection() public {
        // Deploy a new paymaster that's not trusted
        vm.prank(owner);
        MetaTransactionPaymaster untrustedPaymaster = new MetaTransactionPaymaster(address(forwarder), owner);

        // Fund the untrusted paymaster
        vm.prank(user1);
        untrustedPaymaster.depositCredits{value: 1 ether}(user1);

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

        // Should fail because paymaster is not trusted
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: paymaster not trusted");
        forwarder.executeSponsoredTransaction(req, signature, address(untrustedPaymaster));
    }

    function testInsufficientCreditsRejection() public {
        // Don't fund paymaster with enough credits
        vm.prank(user1);
        paymaster.depositCredits{value: 0.0001 ether}(user1); // Very small amount

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

        // Should fail because user doesn't have enough credits
        vm.prank(anyone);
        vm.expectRevert("EIP2771Forwarder: transaction cannot be sponsored");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }

    function testNonceIncrementsCorrectly() public {
        // Fund paymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        uint256 initialNonce = forwarder.getNonce(user1);

        // Create forward request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: initialNonce,
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // Execute transaction
        vm.prank(anyone);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));

        assertTrue(success);
        assertEq(forwarder.getNonce(user1), initialNonce + 1);
    }

    function testPaymasterConfigurationManagement() public {
        address newContract = address(0x999);

        // Only owner can manage sponsored contracts
        vm.prank(user1);
        vm.expectRevert();
        paymaster.setSponsoredContract(newContract, true);

        // Owner can manage sponsored contracts
        vm.prank(owner);
        paymaster.setSponsoredContract(newContract, true);
        assertTrue(paymaster.sponsoredContracts(newContract));

        // Owner can remove sponsored contracts
        vm.prank(owner);
        paymaster.setSponsoredContract(newContract, false);
        assertFalse(paymaster.sponsoredContracts(newContract));
    }

    function testForwarderOwnershipManagement() public {
        address newPaymaster = address(0x888);

        // Only owner can manage trusted paymasters
        vm.prank(user1);
        vm.expectRevert();
        forwarder.addTrustedPaymaster(newPaymaster);

        // Owner can add trusted paymasters
        vm.prank(owner);
        forwarder.addTrustedPaymaster(newPaymaster);
        assertTrue(forwarder.trustedPaymasters(newPaymaster));

        // Owner can remove trusted paymasters
        vm.prank(owner);
        forwarder.removeTrustedPaymaster(newPaymaster);
        assertFalse(forwarder.trustedPaymasters(newPaymaster));
    }

    function testDirectContractCall() public {
        // Test direct contract call (not through forwarder)
        vm.prank(user1);
        sampleContract.updateBalance(500);

        assertEq(sampleContract.getBalance(user1), 500);
    }

    function testContractMessageHandling() public {
        string memory message = "Hello, World!";

        // Test direct message setting
        vm.prank(user1);
        sampleContract.setMessage(message);

        assertEq(sampleContract.getMessage(user1), message);

        // Test message setting through forwarder
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.setMessage.selector, "Meta message")
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        vm.prank(anyone);
        (bool success,) = forwarder.executeSponsoredTransaction(req, signature, address(paymaster));

        assertTrue(success);
        assertEq(sampleContract.getMessage(user1), "Meta message");
    }

    function testPaymasterCanSponsorCheck() public {
        // Fund paymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        // Should be able to sponsor for configured contract
        assertTrue(paymaster.canSponsorTransaction(user1, address(sampleContract), 100000));

        // Should not be able to sponsor for non-configured contract
        assertFalse(paymaster.canSponsorTransaction(user1, address(0x999), 100000));

        // Should not be able to sponsor if user has no credits
        assertFalse(paymaster.canSponsorTransaction(user2, address(sampleContract), 100000));
    }

    function testCreditDepositAndWithdrawal() public {
        uint256 depositAmount = 0.8 ether; // Less than 1 ether that user1 has

        // Test deposit
        vm.prank(user1);
        paymaster.depositCredits{value: depositAmount}(user1);

        assertEq(paymaster.userCredits(user1), depositAmount);
        assertEq(address(paymaster).balance, depositAmount);

        // Test partial withdrawal
        uint256 withdrawAmount = 0.4 ether;
        uint256 userBalanceBefore = user1.balance;

        vm.prank(user1);
        paymaster.withdrawCredits(withdrawAmount);

        assertEq(paymaster.userCredits(user1), depositAmount - withdrawAmount);
        assertEq(user1.balance, userBalanceBefore + withdrawAmount);

        // Test full withdrawal
        vm.prank(user1);
        paymaster.withdrawCredits(depositAmount - withdrawAmount);

        assertEq(paymaster.userCredits(user1), 0);
        assertEq(user1.balance, userBalanceBefore + depositAmount);
    }

    function testDomainSeparatorConsistency() public view {
        bytes32 domainSeparator = forwarder.exposedDomainSeparatorV4();

        // Domain separator should be consistent across calls
        assertEq(domainSeparator, forwarder.exposedDomainSeparatorV4());

        // Domain separator should not be zero
        assertTrue(domainSeparator != bytes32(0));
    }

    function testSignatureVerification() public view {
        // Create a valid request
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        bytes memory validSignature = signForwardRequest(req, USER1_PRIVATE_KEY);
        bytes memory invalidSignature = signForwardRequest(req, USER2_PRIVATE_KEY);

        // Valid signature should verify
        assertTrue(forwarder.verifySignature(req, validSignature));

        // Invalid signature should not verify
        assertFalse(forwarder.verifySignature(req, invalidSignature));
    }

    function testValueTransferThroughForwarder() public {
        // Fund paymaster and relayer
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);

        vm.deal(anyone, 10 ether); // Fund the relayer

        uint256 valueToTransfer = 0.5 ether;
        uint256 initialBalance = address(sampleContract).balance;

        // Create forward request with value
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: valueToTransfer,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100)
        });

        bytes memory signature = signForwardRequest(req, USER1_PRIVATE_KEY);

        // Execute with value (using executeMetaTransaction instead as it's payable)
        vm.prank(anyone);
        (bool success,) = forwarder.executeMetaTransaction{value: valueToTransfer}(req, signature);

        assertTrue(success);
        assertEq(address(sampleContract).balance, initialBalance + valueToTransfer);
    }
}
