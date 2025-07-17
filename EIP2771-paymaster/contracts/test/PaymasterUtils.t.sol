// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";                       // Forge’s Test framework
import "../src/libraries/PaymasterUtils.sol";      // The library under test

contract PaymasterUtilsTest is Test {
    // ─── Storage for mappings ─────────────────────────────────────────────────
    // These mimic the storage variables the library expects.

    mapping(address => bool)     internal sponsoredContracts;
    mapping(address => uint256)  internal userCredits;
    mapping(address => bool)     internal whitelistedTokens;

    // ─── Wrappers ────────────────────────────────────────────────────────────
    // We declare these as external so that memory → calldata conversion
    // happens automatically when we call them via `this.` in tests.

    /// Wraps calculateEstimatedFee(...) which is pure
    function callCalculateEstimatedFee(
        uint256 gasLimit,
        uint256 gasPrice,
        uint256 baseFee,
        uint256 feeMultiplier
    ) external pure returns (uint256) {
        return PaymasterUtils.calculateEstimatedFee(
            gasLimit, gasPrice, baseFee, feeMultiplier
        );
    }

    /// Wraps validateSponsorshipParams(...) which reads from sponsoredContracts
    function callValidateSponsorshipParams(
        address user,
        address target,
        uint256 gasLimit,
        uint256 maxGasLimit
    ) external view returns (bool) {
        return PaymasterUtils.validateSponsorshipParams(
            user, target, gasLimit, maxGasLimit, sponsoredContracts
        );
    }

    /// Wraps hasSufficientCredits(...) which reads from userCredits
    function callHasSufficientCredits(
        address user,
        uint256 requiredAmount
    ) external view returns (bool) {
        return PaymasterUtils.hasSufficientCredits(
            user, requiredAmount, userCredits
        );
    }

    /// Wraps isTokenWhitelisted(...) which reads from whitelistedTokens
    function callIsTokenWhitelisted(
        address token
    ) external view returns (bool) {
        return PaymasterUtils.isTokenWhitelisted(
            token, whitelistedTokens
        );
    }

    // ─── calculateEstimatedFee Tests ─────────────────────────────────────────

    function testCalculateEstimatedFee_NonzeroGasPrice() public {
        // Standard case: gasPrice=2, (100+50)*2*10/100 = 30
        uint256 fee = this.callCalculateEstimatedFee(100, 2, 50, 10);
        assertEq(fee, 30);
    }

    function testCalculateEstimatedFee_ZeroGasPriceDefaults() public {
        // gasPrice=0 → default to 1 gwei (1e9). 
        // (100+50)*1e9*5/100 = 7.5e9
        uint256 expected = (150 * 1e9 * 5) / 100;
        uint256 fee = this.callCalculateEstimatedFee(100, 0, 50, 5);
        assertEq(fee, expected);
    }

    // ─── validateSponsorshipParams Tests ────────────────────────────────────

    function testValidateSponsorshipParams_AllValid() public {
        address user   = address(0x1);
        address target = address(0x2);
        sponsoredContracts[target] = true;  // mark as sponsored

        // gasLimit=10, maxGasLimit=20 → valid
        bool ok = this.callValidateSponsorshipParams(user, target, 10, 20);
        assertTrue(ok);
    }

    function testValidateSponsorshipParams_InvalidUser() public {
        // user=0x0 is invalid
        sponsoredContracts[address(3)] = true;
        assertFalse(this.callValidateSponsorshipParams(
            address(0), address(3), 1, 10
        ));
    }

    function testValidateSponsorshipParams_InvalidTarget() public {
        // target=0x0 is invalid
        assertFalse(this.callValidateSponsorshipParams(
            address(1), address(0), 1, 10
        ));
    }

    function testValidateSponsorshipParams_ZeroGas() public {
        address tgt = address(4);
        sponsoredContracts[tgt] = true;
        assertFalse(this.callValidateSponsorshipParams(
            address(1), tgt, 0, 10
        ));
    }

    function testValidateSponsorshipParams_TooMuchGas() public {
        address tgt = address(5);
        sponsoredContracts[tgt] = true;
        assertFalse(this.callValidateSponsorshipParams(
            address(1), tgt, 11, 10
        ));
    }

    function testValidateSponsorshipParams_NotSponsored() public {
        // target not marked in sponsoredContracts → false
        assertFalse(this.callValidateSponsorshipParams(
            address(1), address(9), 1, 10
        ));
    }

    // ─── hasSufficientCredits Tests ───────────────────────────────────────────

    function testHasSufficientCredits_Enough() public {
        address usr = address(0x10);
        userCredits[usr] = 100;
        assertTrue(this.callHasSufficientCredits(usr, 50));
    }

    function testHasSufficientCredits_Exact() public {
        address usr = address(0x11);
        userCredits[usr] = 20;
        assertTrue(this.callHasSufficientCredits(usr, 20));
    }

    function testHasSufficientCredits_Insufficient() public {
        address usr = address(0x12);
        userCredits[usr] = 5;
        assertFalse(this.callHasSufficientCredits(usr, 10));
    }

    function testHasSufficientCredits_None() public {
        // default mapping returns 0
        assertFalse(this.callHasSufficientCredits(
            address(0x13), 1
        ));
    }

    // ─── isTokenWhitelisted Tests ────────────────────────────────────────────

    function testIsTokenWhitelisted_True() public {
        address token = address(0x20);
        whitelistedTokens[token] = true;
        assertTrue(this.callIsTokenWhitelisted(token));
    }

    function testIsTokenWhitelisted_False() public {
        // default mapping → false
        assertFalse(this.callIsTokenWhitelisted(address(0x21)));
    }
}
