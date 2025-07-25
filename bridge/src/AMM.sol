// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AMM is Ownable {
    IERC20 internal qtoken;
    IERC20 internal qobi;
    uint256 internal _currentSwapRate = 1000; // Initial rate: 1 Qtoken = 1000 Qobi
    uint256 internal constant adjustmentBlock = 5; // Rate increases after 5 blocks
    uint256 internal _finalRate = 1550; // New rate after adjustment
    uint256 internal _totalSwappedQobi; // Track total Qobi swapped
    uint256 internal constant maxSwappableQobi = 1550000000000; // 1.55 billion Qobi cap

    event Swap(address indexed user, uint256 qtokenAmount, uint256 qobiAmount);
    event RateAdjusted(uint256 newRate, uint256 blockNumber);

    constructor(address _qtoken, address _qobi) Ownable(msg.sender) {
        qtoken = IERC20(_qtoken);
        qobi = IERC20(_qobi);
    }

    function currentSwapRate() external view returns (uint256) {
        return _currentSwapRate;
    }

    function finalRate() external view returns (uint256) {
        return _finalRate;
    }

    function totalSwappedQobi() external view returns (uint256) {
        return _totalSwappedQobi;
    }

    function swapQtokenForQobi(uint256 qtokenAmount) external {
        require(qtokenAmount > 0, "Amount must be greater than 0");
        require(qtoken.balanceOf(msg.sender) >= qtokenAmount, "Insufficient Qtoken balance");
        require(qtoken.allowance(msg.sender, address(this)) >= qtokenAmount, "Approve Qtoken first");

        uint256 qobiAmount = qtokenAmount * _currentSwapRate;
        require(_totalSwappedQobi + qobiAmount <= maxSwappableQobi, "Swap cap exceeded");

        if (block.number >= adjustmentBlock) {
            _currentSwapRate = _finalRate; // Adjust rate to 1550 after 5 blocks
        }

        require(qtoken.transferFrom(msg.sender, address(this), qtokenAmount), "Qtoken transfer failed");
        require(qobi.transfer(msg.sender, qobiAmount), "Qobi transfer failed");

        _totalSwappedQobi += qobiAmount;
        emit Swap(msg.sender, qtokenAmount, qobiAmount);
    }

    function adjustRate() external onlyOwner {
        if (block.number >= adjustmentBlock && _currentSwapRate != _finalRate) {
            _currentSwapRate = _finalRate;
            emit RateAdjusted(_currentSwapRate, block.number);
        }
    }
}
