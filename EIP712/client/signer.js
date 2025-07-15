import { ethers } from 'ethers';
import axios from 'axios';

const provider = new ethers.JsonRpcProvider('http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc');
const contractAddress = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6'; // Updated to match relayer

// Create a wallet (user)
// const pvtk1 = '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97';
// const pvtk2 = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

// const creatorAddress = new ethers.Wallet(pvtk1, provider).address;
// const interactorAddress = new ethers.Wallet(pvtk2, provider).address;

const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const userWallet = new ethers.Wallet(privateKey, provider);

// EIP-712 domain and types
const domain = {
  name: "QoneqtMetaTx",
  version: "1",
  chainId: 930393, // Avalanche subnet chain ID
  verifyingContract: contractAddress
};

const types = {
  MetaTx: [
    { name: "user", type: "address" },
    { name: "interaction", type: "string" },
    { name: "nonce", type: "uint256" }
  ]
};

async function signAndSend() {
  const interaction = 'share_post-23456';
  
  // Get the current nonce for the user from the relayer endpoint
  try {
    const nonceResponse = await axios.get(`http://localhost:8000/nonce/${userWallet.address}`);
    const nonce = parseInt(nonceResponse.data.nonce);
    
    console.log(`User: ${userWallet.address}`);
    console.log(`Current nonce: ${nonce}`);
    console.log(`Interaction: ${interaction}`);

    const value = {
      user: userWallet.address,
      interaction,
      nonce
    };

    const signature = await userWallet.signTypedData(domain, types, value);

    try {
      const res = await axios.post('http://localhost:8000/relayMetaTx', {
        user: userWallet.address,
        interaction,
        nonce,
        signature
      });
      console.log('✅ Transaction successful:', res.data);
    } catch (error) {
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error('❌ Error:', error.response.data.error || error.response.data);
        if (error.response.data.significance !== undefined) {
          console.error('📊 Significance:', error.response.data.significance);
        }
        console.error('🔢 Status:', error.response.status);
      } else {
        // Other errors (network, etc.)
        console.error('🌐 Request failed:', error.message);
      }
    }
  } catch (nonceError) {
    console.error('❌ Failed to fetch nonce:', nonceError.message);
  }
}

signAndSend().catch(console.error);


// Rate limiters 

// Contexts { these txes --> customised Ai Validation context }