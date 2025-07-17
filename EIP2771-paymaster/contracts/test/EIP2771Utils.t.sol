// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";                      // Forge’s testing framework
import "../src/libraries/EIP2771Utils.sol";       // The library under test

contract EIP2771UtilsTest is Test {
    // ─── Wrappers ────────────────────────────────────────────────────────────
    // We declare these as external so that memory→calldata conversion happens
    // automatically when we call them via `this.` in our tests.

    /// Wraps the internal library call for extractSender(bytes calldata)
    function callExtractSender(bytes calldata data) external pure returns (address) {
        return EIP2771Utils.extractSender(data);
    }

    /// Wraps the internal library call for extractData(bytes calldata)
    function callExtractData(bytes calldata data) external pure returns (bytes memory) {
        return EIP2771Utils.extractData(data);
    }

    // ─── extractSender Tests ─────────────────────────────────────────────────

    function testExtractSender_DataContainsAddress() public {
        // Pick an “expected” address that uses only digits so no checksum errors
        address expected = address(0x0000000000000000000000000000000000000022);

        // Build some arbitrary payload and append our expected address
        bytes memory payload  = abi.encodePacked("foo", uint8(1));
        bytes memory appended = abi.encodePacked(payload, expected);

        // Call our external wrapper. memory → calldata conversion occurs here.
        address sender = this.callExtractSender(appended);

        // Verify the library pulled out the last 20 bytes correctly
        assertEq(sender, expected);
    }

    function testExtractSender_DataTooShort() public {
        // If the data is shorter than 20 bytes, the library returns address(0)
        bytes memory shortData = abi.encodePacked("short");
        address sender = this.callExtractSender(shortData);
        assertEq(sender, address(0));
    }

    // ─── extractData Tests ────────────────────────────────────────────────────

    function testExtractData_DataContainsAddress() public {
        // Use a dummy address comprised of digits only
        address dummy = address(0x0000000000000000000000000000000000000011);

        // Build payload + dummy at the end
        bytes memory payload  = abi.encodePacked("payload", uint16(2));
        bytes memory appended = abi.encodePacked(payload, dummy);

        // Call wrapper and verify we got exactly the original payload back
        bytes memory extracted = this.callExtractData(appended);
        assertEq(keccak256(extracted), keccak256(payload));
    }

    function testExtractData_DataTooShort() public {
        // If data < 20 bytes, extractData should just return the full data
        bytes memory shortData = abi.encodePacked("hey");
        bytes memory extracted = this.callExtractData(shortData);
        assertEq(keccak256(extracted), keccak256(shortData));
    }

    // ─── calculateGasCost Test ────────────────────────────────────────────────

    function testCalculateGasCost_Basic() public {
        // Formula: (gasUsed + baseFee) * gasPrice * multiplier / 100
        // (100 + 50) * 2 * 10 / 100 = 30
        uint256 cost = EIP2771Utils.calculateGasCost(100, 2, 50, 10);
        assertEq(cost, 30);
    }

    // ─── validateGasLimit Tests ──────────────────────────────────────────────

    function testValidateGasLimit_AllCases() public {
        // Valid lower bound
        assertTrue(EIP2771Utils.validateGasLimit(1, 100));
        // Valid exactly at max
        assertTrue(EIP2771Utils.validateGasLimit(100, 100));
        // Zero gas is invalid
        assertFalse(EIP2771Utils.validateGasLimit(0, 100));
        // Above max is invalid
        assertFalse(EIP2771Utils.validateGasLimit(101, 100));
    }
}
