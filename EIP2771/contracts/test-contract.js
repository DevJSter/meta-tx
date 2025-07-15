const { ethers } = require('ethers');

async function testContract() {
    const provider = new ethers.JsonRpcProvider('http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc');
    
    const forwarderABI = [
        'function nonces(address owner) external view returns (uint256)',
    ];
    
    const forwarder = new ethers.Contract('0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', forwarderABI, provider);
    
    try {
        const nonce = await forwarder.nonces('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
        console.log('✅ Contract accessible! User nonce:', nonce.toString());
        
        // Check if forwarder has the AI validator set
        const owner = await provider.call({
            to: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
            data: '0x8da5cb5b' // owner() function
        });
        console.log('✅ Forwarder owner:', owner);
        
    } catch (error) {
        console.error('❌ Contract test failed:', error.message);
    }
}

testContract();
