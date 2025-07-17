// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/EIP2771Forwarder.sol";

contract EIP2771ForwarderExtraTest is Test {
    EIP2771Forwarder forwarder;
    address owner;
    address paymaster1 = address(0x123);
    address paymaster2 = address(0x456);
    address attacker = address(0x999);

    event PaymasterAdded(address indexed paymaster);
    event PaymasterRemoved(address indexed paymaster);

    function setUp() public {
        owner = address(this);
        // Deploy forwarder with this contract as owner
        forwarder = new EIP2771Forwarder(owner);
    }

    function testAddTrustedPaymasterByOwner() public {
        // Expect the PaymasterAdded event
        vm.expectEmit(true, false, false, false);
        emit PaymasterAdded(paymaster1);

        forwarder.addTrustedPaymaster(paymaster1);

        // mapping getter should now be true
        assertTrue(forwarder.trustedPaymasters(paymaster1));
    }

    function testAddTrustedPaymaster_IsIdempotent() public {
        // Add twice: no revert, still true
        forwarder.addTrustedPaymaster(paymaster1);
        forwarder.addTrustedPaymaster(paymaster1);
        assertTrue(forwarder.trustedPaymasters(paymaster1));
    }

    function testRemoveTrustedPaymasterByOwner() public {
        forwarder.addTrustedPaymaster(paymaster2);
        assertTrue(forwarder.trustedPaymasters(paymaster2));

        // Expect the PaymasterRemoved event
        vm.expectEmit(true, false, false, false);
        emit PaymasterRemoved(paymaster2);

        forwarder.removeTrustedPaymaster(paymaster2);

        assertFalse(forwarder.trustedPaymasters(paymaster2));
    }

    function testRemoveTrustedPaymaster_IsIdempotent() public {
        // Removing an untrusted address simply sets to false, no revert
        forwarder.removeTrustedPaymaster(paymaster1);
        assertFalse(forwarder.trustedPaymasters(paymaster1));
        // Remove again
        forwarder.removeTrustedPaymaster(paymaster1);
        assertFalse(forwarder.trustedPaymasters(paymaster1));
    }

    function testOnlyOwnerCanAdd() public {
        vm.prank(attacker);
        vm.expectRevert(); // any revert is fine
        forwarder.addTrustedPaymaster(paymaster1);
    }

    function testOnlyOwnerCanRemove() public {
        forwarder.addTrustedPaymaster(paymaster1);
        vm.prank(attacker);
        vm.expectRevert(); // must revert for non-owner
        forwarder.removeTrustedPaymaster(paymaster1);
    }

    function testIsTrustedForwarderGetter() public {
        // The contract is its own trusted forwarder
        assertTrue(forwarder.isTrustedForwarder(address(forwarder)));
        // Some other address is not
        assertFalse(forwarder.isTrustedForwarder(address(0x9999)));
    }
}
