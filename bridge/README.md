# Qoneqt Meta-TX Bridge

## Overview
This repository contains smart contracts for a token bridge system between C-Chain and R-Chain for Qobit tokens. It includes locking on C-Chain, bridging, and swapping on R-Chain. Built using Foundry for development and deployment.

## Contracts
- **QobitToken.sol**: Mock ERC20 token (mintable) for testing Qobit interactions.
- **CChainQobitLock.sol**: Handles locking Qobits on C-Chain with a 24-hour timelock before bridging.
- **RChainQobitSwap.sol**: Manages minting and swapping Qobits on R-Chain after bridging.

## Deployment Details
Deployed on local testnet.

- **QobitToken**: `0xcA3a32EC2D1ad208f71604059F6DaaDB4Eb46932`
- **RChainQobitSwap**: `0x1AaCF3e6575D04Bc5D81a9ca6F806d0f2c133E14`
- **CChainQobitLock**: `0x18F5C787Eb1cf4151e913A5d38Ace2Ba13285726`

Deployment script: `script/DeployContracts.s.sol`. Transaction logs: `broadcast/DeployContracts.s.sol/930393/run-latest.json`.