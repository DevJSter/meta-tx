import { ethers } from 'ethers';
import axios from 'axios';

const provider = new ethers.JsonRpcProvider('http://localhost:9650/ext/bc/HekfYrK1fxgzkBSPj5XwBUNfxvZuMS7wLq7p7r6bQQJm6jA2M/rpc');
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Default for local testing

// Create a wallet (user)
const privateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
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
  const interaction = 'share_post-943216';
  
  // Get the current nonce for the user
  const contract = new ethers.Contract(
    contractAddress,
    ['function nonces(address) view returns (uint256)'],
    provider
  );
  const nonce = Number(await contract.nonces(userWallet.address));
  
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
    const res = await axios.post('http://localhost:4000/relayMetaTx', {
      user: userWallet.address,
      interaction,
      nonce,
      signature
    });
    console.log('Relayed tx hash:', res.data);
  } catch (error) {
    if (error.response) {
      // Server responded with a status other than 2xx
      console.error('Error:', error.response.data.error || error.response.data);
      console.error('Significance:', error.response.data.significance);
      console.error('Status:', error.response.status);
    } else {
      // Other errors (network, etc.)
      console.error('Request failed:', error.message);
    }
  }
}

signAndSend().catch(console.error);


// Rate limiters 

// Contexts { these txes --> customised Ai Validation context }