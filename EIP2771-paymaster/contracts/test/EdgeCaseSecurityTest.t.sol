// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "./EIP2771ForwarderTestHelper.sol";
import "../src/MetaTransactionPaymaster.sol";
import "../src/OwnerFundedPaymaster.sol";
import "../src/SampleContract.sol";
import "../src/interfaces/IEIP2771Forwarder.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract ReentrancyAttacker {
    EIP2771ForwarderTestHelper public forwarder;
    MetaTransactionPaymaster public paymaster;
    bool public attacked = false;
    
    constructor(address _forwarder, address _paymaster) {
        forwarder = EIP2771ForwarderTestHelper(_forwarder);
        paymaster = MetaTransactionPaymaster(payable(_paymaster));
    }
    
    function attack() external {
        // Try to reenter during execution
        attacked = true;
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: address(this),
            to: address(this),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(address(this)),
            data: abi.encodeWithSelector(this.attack.selector)
        });
        
        bytes memory signature = new bytes(65); // Empty signature
        
        // This should fail due to reentrancy protection
        forwarder.executeMetaTransaction(req, signature);
    }
}

contract MaliciousContract {
    bool public executed = false;
    
    function maliciousFunction() external {
        executed = true;
        // Try to call sensitive functions
        // Note: selfdestruct is deprecated, so we'll just set a flag
        executed = true;
    }
    
    function infiniteLoop() external pure {
        while (true) {
            // This will consume all gas
        }
    }
}

contract GasGriefingContract {
    uint256 public counter = 0;
    
    function consumeGas() external {
        // Consume gas inefficiently
        for (uint256 i = 0; i < 1000000; i++) {
            counter += i;
        }
    }
}

/**
 * @title EdgeCaseSecurityTest
 * @dev Advanced security tests and edge cases for EIP2771 system
 */
contract EdgeCaseSecurityTest is Test {
    EIP2771ForwarderTestHelper public forwarder;
    MetaTransactionPaymaster public paymaster;
    OwnerFundedPaymaster public ownerPaymaster;
    SampleERC2771Contract public sampleContract;
    MockERC20 public mockToken;
    ReentrancyAttacker public attacker;
    MaliciousContract public maliciousContract;
    GasGriefingContract public gasGriefingContract;
    
    address public owner = address(0x123);
    address public user1;
    address public user2;
    address public relayer = address(0x789);
    address public hacker = address(0xBAD);
    
    uint256 public constant USER1_PRIVATE_KEY = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 public constant USER2_PRIVATE_KEY = 0x2345678901bcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 public constant HACKER_PRIVATE_KEY = 0x3456789012cdef1234567890abcdef1234567890abcdef1234567890abcdef;
    
    event TransactionExecuted(address indexed from, address indexed to, bool success);
    event PaymasterUsed(address indexed paymaster, address indexed user, uint256 cost);
    
    function setUp() public {
        // Derive addresses from private keys
        user1 = vm.addr(USER1_PRIVATE_KEY);
        user2 = vm.addr(USER2_PRIVATE_KEY);
        hacker = vm.addr(HACKER_PRIVATE_KEY);
        
        // Fund accounts first
        vm.deal(owner, 100 ether);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(relayer, 10 ether);
        vm.deal(hacker, 10 ether);
        
        vm.startPrank(owner);
        
        // Deploy all contracts
        forwarder = new EIP2771ForwarderTestHelper(owner);
        paymaster = new MetaTransactionPaymaster(address(forwarder), owner);
        ownerPaymaster = new OwnerFundedPaymaster(address(forwarder), owner);
        sampleContract = new SampleERC2771Contract(address(forwarder), owner);
        mockToken = new MockERC20();
        attacker = new ReentrancyAttacker(address(forwarder), address(paymaster));
        maliciousContract = new MaliciousContract();
        gasGriefingContract = new GasGriefingContract();
        
        // Configure system
        forwarder.addTrustedPaymaster(address(paymaster));
        forwarder.addTrustedPaymaster(address(ownerPaymaster));
        
        paymaster.setSponsoredContract(address(sampleContract), true);
        paymaster.setWhitelistedToken(address(mockToken), true);
        
        ownerPaymaster.setSponsoredContract(address(sampleContract), true);
        ownerPaymaster.ownerDeposit{value: 10 ether}();
        
        // Fund paymaster
        paymaster.depositCredits{value: 5 ether}(owner);
        
        // Transfer tokens to users
        mockToken.transfer(user1, 1000 * 10**18);
        mockToken.transfer(user2, 1000 * 10**18);
        
        vm.stopPrank();
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
        
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                forwarder.exposedDomainSeparatorV4(),
                structHash
            )
        );
    }
    
    function _signRequest(IEIP2771Forwarder.ForwardRequest memory req, uint256 privateKey) internal view returns (bytes memory) {
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
    
    // ============ Signature Replay Attack Tests ============
    
    function testSignatureReplayAttack() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        // First execution should succeed
        vm.prank(relayer);
        (bool success1,) = forwarder.executeMetaTransaction(req, signature);
        assertTrue(success1);
        
        // Second execution with same signature should fail
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeMetaTransaction(req, signature);
    }
    
    function testCrossChainSignatureReuse() public {
        // Test that signatures can't be reused across different chains
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        // Change chain ID
        vm.chainId(999);
        
        // Should fail due to chain ID mismatch in domain separator
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeMetaTransaction(req, signature);
    }
    
    // ============ Gas Limit Attack Tests ============
    
    function testGasLimitExploitation() public {
        bytes memory data = abi.encodeWithSelector(GasGriefingContract.consumeGas.selector);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(gasGriefingContract),
            value: 0,
            gas: 2000000, // High gas limit
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        // Should fail due to gas limit restrictions
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: transaction cannot be sponsored");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }
    
    function testOutOfGasHandling() public {
        bytes memory data = abi.encodeWithSelector(GasGriefingContract.consumeGas.selector);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(gasGriefingContract),
            value: 0,
            gas: 50000, // Low gas limit
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Should handle out of gas gracefully
        assertFalse(success);
    }
    
    // ============ Signature Manipulation Tests ============
    
    function testMalformedSignature() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory malformedSignature = new bytes(64); // Too short
        
        vm.prank(relayer);
        vm.expectRevert(); // Accept any revert due to malformed signature
        forwarder.executeMetaTransaction(req, malformedSignature);
    }
    
    function testSignatureWithWrongV() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(USER1_PRIVATE_KEY, digest);
        
        // Modify v to invalid value
        bytes memory invalidSignature = abi.encodePacked(r, s, uint8(v + 2));
        
        vm.prank(relayer);
        vm.expectRevert(); // Accept any revert due to invalid signature
        forwarder.executeMetaTransaction(req, invalidSignature);
    }
    
    // ============ Reentrancy Attack Tests ============
    
    function testReentrancyAttack() public {
        // This test is more conceptual as our current contracts don't have
        // vulnerable external calls, but we can test the pattern
        
        bytes memory data = abi.encodeWithSelector(ReentrancyAttacker.attack.selector);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: address(attacker),
            to: address(attacker),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(address(attacker)),
            data: data
        });
        
        bytes memory signature = _signRequest(req, HACKER_PRIVATE_KEY);
        
        // This should be handled gracefully without reentrancy
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeMetaTransaction(req, signature);
    }
    
    // ============ Access Control Tests ============
    
    function testUnauthorizedPaymasterManagement() public {
        address newPaymaster = address(0x999);
        
        // Non-owner cannot add paymaster
        vm.prank(hacker);
        vm.expectRevert();
        forwarder.addTrustedPaymaster(newPaymaster);
        
        // Non-owner cannot remove paymaster
        vm.prank(hacker);
        vm.expectRevert();
        forwarder.removeTrustedPaymaster(address(paymaster));
    }
    
    function testUnauthorizedContractManagement() public {
        address newContract = address(0x999);
        
        // Non-owner cannot manage sponsored contracts
        vm.prank(hacker);
        vm.expectRevert();
        paymaster.setSponsoredContract(newContract, true);
        
        // Non-owner cannot manage token whitelist
        vm.prank(hacker);
        vm.expectRevert();
        paymaster.setWhitelistedToken(address(mockToken), false);
    }
    
    function testUnauthorizedEmergencyWithdraw() public {
        vm.prank(hacker);
        vm.expectRevert();
        paymaster.emergencyWithdraw();
        
        vm.prank(hacker);
        vm.expectRevert();
        ownerPaymaster.emergencyWithdraw();
    }
    
    // ============ Economic Attack Tests ============
    
    function testPaymasterDraining() public {
        // Fund user1 with credits first
        vm.prank(user1);
        paymaster.depositCredits{value: 5 ether}(user1);
        
        // Try to drain paymaster funds by excessive usage
        uint256 initialBalance = address(paymaster).balance;
        
        for (uint256 i = 0; i < 10; i++) {
            bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, i);
            
            IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
                from: user1,
                to: address(sampleContract),
                value: 0,
                gas: 100000,
                nonce: forwarder.getNonce(user1),
                data: data
            });
            
            bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
            
            vm.prank(relayer);
            forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
        }
        
        // Paymaster should still have funds (protected by rate limiting or other mechanisms)
        assertGt(address(paymaster).balance, initialBalance / 2);
    }
    
    function testTokenApprovalAttack() public {
        // Try to exploit token approval mechanisms
        uint256 amount = 1000 * 10**18;
        
        vm.prank(user1);
        mockToken.approve(address(paymaster), amount);
        
        // Attacker tries to deposit tokens on behalf of user1
        vm.prank(hacker);
        vm.expectRevert(); // Accept any revert due to insufficient allowance
        paymaster.depositToken(address(mockToken), amount);
    }
    
    // ============ Data Validation Tests ============
    
    function testEmptyCalldata() public {
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: "" // Empty calldata
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Should fail because contract doesn't have receive/fallback function
        assertFalse(success);
    }
    
    function testInvalidTargetContract() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(0), // Invalid target
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Call to address(0) succeeds but does nothing
        assertTrue(success);
    }
    
    function testValueTransferWithoutEth() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 1 ether, // Requesting value transfer
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Should fail because relayer doesn't have enough ETH
        assertFalse(success);
    }
    
    // ============ Boundary Value Tests ============
    
    function testMaxGasLimit() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: type(uint256).max, // Maximum gas limit
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: transaction cannot be sponsored");
        forwarder.executeSponsoredTransaction(req, signature, address(paymaster));
    }
    
    function testZeroGasLimit() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 0, // Zero gas limit
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Should fail due to insufficient gas
        assertFalse(success);
    }
    
    function testMaxNonceValue() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: type(uint256).max, // Maximum nonce value
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        vm.expectRevert("EIP2771Forwarder: signature does not match request");
        forwarder.executeMetaTransaction(req, signature);
    }
    
    // ============ Event Emission Tests ============
    
    function testEventEmission() public {
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        // Test that events are emitted correctly
        vm.expectEmit(true, true, false, true);
        emit MetaTransactionExecuted(user1, address(sampleContract), 0, 100000, forwarder.getNonce(user1), data, true);
        
        vm.prank(relayer);
        forwarder.executeMetaTransaction(req, signature);
    }
    
    // Define the event for testing
    event MetaTransactionExecuted(
        address indexed originalSender,
        address indexed targetContract,
        uint256 value,
        uint256 gasLimit,
        uint256 nonce,
        bytes data,
        bool success
    );
    
    // ============ Fuzz Tests ============
    
    function testFuzzGasLimit(uint256 gasLimit) public {
        vm.assume(gasLimit >= 30000 && gasLimit < 1000000); // Reasonable gas range, minimum for contract execution
        
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: gasLimit,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        // Should succeed with reasonable gas limits
        assertTrue(success);
    }
    
    function testFuzzValue(uint256 value) public {
        vm.assume(value <= 1 ether); // Reasonable value range
        
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: value,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data
        });
        
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        // Fund relayer with enough ETH
        vm.deal(relayer, 10 ether);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction{value: value}(req, signature);
        
        // Should succeed with proper value
        assertTrue(success);
    }
    
    function testFuzzTokenAmount(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1000 * 10**18); // Reasonable token amount
        
        vm.prank(user1);
        mockToken.approve(address(paymaster), amount);
        
        vm.prank(user1);
        paymaster.depositToken(address(mockToken), amount);
        
        assertEq(paymaster.tokenBalances(user1, address(mockToken)), amount);
    }
    
    // ============ Integration Tests ============
    
    function testFullWorkflowWithMultiplePaymasters() public {
        // Test switching between different paymasters
        
        // Give user1 credits for MetaTransactionPaymaster
        vm.prank(user1);
        paymaster.depositCredits{value: 1 ether}(user1);
        
        // Transaction 1: Using MetaTransactionPaymaster
        bytes memory data1 = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 100);
        IEIP2771Forwarder.ForwardRequest memory req1 = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data1
        });
        bytes memory signature1 = _signRequest(req1, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success1,) = forwarder.executeSponsoredTransaction(req1, signature1, address(paymaster));
        
        // Transaction 2: Using OwnerFundedPaymaster
        bytes memory data2 = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 200);
        IEIP2771Forwarder.ForwardRequest memory req2 = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data2
        });
        bytes memory signature2 = _signRequest(req2, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success2,) = forwarder.executeSponsoredTransaction(req2, signature2, address(ownerPaymaster));
        
        assertTrue(success1);
        assertTrue(success2);
        assertEq(sampleContract.getBalance(user1), 300); // 100 + 200 = 300
    }
    
    function testConcurrentTransactions() public {
        // Fund users with credits first
        vm.prank(user1);
        paymaster.depositCredits{value: 2 ether}(user1);
        vm.prank(user2);
        paymaster.depositCredits{value: 2 ether}(user2);
        
        // Test multiple transactions from different users
        
        bytes memory data1 = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 1000);
        IEIP2771Forwarder.ForwardRequest memory req1 = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user1),
            data: data1
        });
        bytes memory signature1 = _signRequest(req1, USER1_PRIVATE_KEY);
        
        bytes memory data2 = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 2000);
        IEIP2771Forwarder.ForwardRequest memory req2 = IEIP2771Forwarder.ForwardRequest({
            from: user2,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: forwarder.getNonce(user2),
            data: data2
        });
        bytes memory signature2 = _signRequest(req2, USER2_PRIVATE_KEY);
        
        // Execute both transactions
        vm.prank(relayer);
        (bool success1,) = forwarder.executeSponsoredTransaction(req1, signature1, address(paymaster));
        
        vm.prank(relayer);
        (bool success2,) = forwarder.executeSponsoredTransaction(req2, signature2, address(paymaster));
        
        assertTrue(success1);
        assertTrue(success2);
        assertEq(sampleContract.getBalance(user1), 1000);
        assertEq(sampleContract.getBalance(user2), 2000);
    }
    
    // ============ Cleanup and State Tests ============
    
    function testContractUpgradability() public view {
        // Test that contracts can be safely upgraded
        // This is more of a design consideration test
        
        // Check that important state is preserved
        assertEq(forwarder.owner(), owner);
        assertEq(paymaster.owner(), owner);
        assertEq(ownerPaymaster.owner(), owner);
        
        // Check that configurations are maintained
        assertTrue(forwarder.trustedPaymasters(address(paymaster)));
        assertTrue(paymaster.sponsoredContracts(address(sampleContract)));
        assertTrue(ownerPaymaster.sponsoredContracts(address(sampleContract)));
    }
    
    function testStateConsistency() public {
        // Test that state remains consistent across operations
        
        uint256 initialNonce = forwarder.getNonce(user1);
        
        // Execute a transaction
        bytes memory data = abi.encodeWithSelector(SampleERC2771Contract.updateBalance.selector, 500);
        IEIP2771Forwarder.ForwardRequest memory req = IEIP2771Forwarder.ForwardRequest({
            from: user1,
            to: address(sampleContract),
            value: 0,
            gas: 100000,
            nonce: initialNonce,
            data: data
        });
        bytes memory signature = _signRequest(req, USER1_PRIVATE_KEY);
        
        vm.prank(relayer);
        (bool success,) = forwarder.executeMetaTransaction(req, signature);
        
        assertTrue(success);
        assertEq(forwarder.getNonce(user1), initialNonce + 1);
        assertEq(sampleContract.getBalance(user1), 500);
    }
}
