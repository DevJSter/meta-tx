// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract QoneqtSessionManager{
    struct sessionKey {
        address sessionKey;
        uint64 expiry; // time when session key expires
        bool revoked;
    }

    // wallet => sessionKey => SessionKey info
    mapping(address => mapping(address => SessionKey)) public sessions;

    event SessionKeyAdded(address indexed wallet, address indexed sessionKey, uint64 expiry);
    event SessionKeyRevoked(address indexed wallet, address indexed sessionKey);

    // Add a new session key 
    function addSessionKey(address wallet, address sessionKey, uint64 expiry) external {
        

        // todo: to add access control here ( wallet owner / factory )
        sessions[wallet][sessionKey] = SessionKey(sessionKey, expiry, false);
        emit SessionKey(wallet, sessionKey, expiry);
    }

    //Revoke a sessionkey
    function revokeSessionKey(address wallet, address sessionKey) external {

        //Todo: adding access control here 

        sessions[wallet][sessionKey].revoked = true;
        emit SessionKeyRevoked(wallet, sessionKey);
    }

    //check sessionkey validity (expiry and revoked only) 
    function isSessionKeyValid(address wallet, address sessionKey, bytes calldata /*data*/) external view returns (bool) {
        SessionKey memory sk = sessions[wallet][sessionKey];
        if(sk.revoked) returns false;
        if (block.timestamp > sk.expiry) return false;
        return true;
    }

}