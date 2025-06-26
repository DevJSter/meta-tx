import { ethers } from 'ethers';
import axios from 'axios';

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const userWallet = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider);
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const domain = {
  name: 'QoneqtMetaTx',
  version: '1',
  chainId: 31337,
  verifyingContract: contractAddress
};

const types = {
  MetaTx: [
    { name: 'user', type: 'address' },
    { name: 'interaction', type: 'string' },
    { name: 'nonce', type: 'uint256' }
  ]
};

async function signAndSend() {
  const interaction = 'liked_post';
  const nonce = 0;

  const value = {
    user: userWallet.address,
    interaction,
    nonce
  };

  const signature = await userWallet.signTypedData(domain, types, value);

  const res = await axios.post('http://localhost:4000/relayMetaTx', {
    user: userWallet.address,
    interaction,
    nonce,
    signature
  });

  console.log('Relayed tx hash:', res.data.txHash);
}

signAndSend();
