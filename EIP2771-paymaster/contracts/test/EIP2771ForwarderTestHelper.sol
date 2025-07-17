// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../src/EIP2771Forwarder.sol";

contract EIP2771ForwarderTestHelper is EIP2771Forwarder {
    constructor(address initialOwner) EIP2771Forwarder(initialOwner) {}

    function exposedHashTypedDataV4(bytes32 structHash) public view returns (bytes32) {
        return _hashTypedDataV4(structHash);
    }
    
    function exposedDomainSeparatorV4() public view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
