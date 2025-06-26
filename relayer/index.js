const express = require('express');
const ethers = require('ethers');
const dotenv = require('dotenv');
const MetaTxInteraction = require('./MetaTxInteraction.json');

dotenv.config();
const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  MetaTxInteraction.abi,
  wallet
);

app.post('/relayMetaTx', async (req, res) => {
  const { user, interaction, nonce, signature } = req.body;

  // AI validation stub — replace with real AI check later
  if (!interaction.startsWith('liked_') && !interaction.startsWith('comment_')) {
    return res.status(400).send({ error: 'Interaction rejected by AI filter' });
  }

  try {
    const tx = await contract.executeMetaTx(user, interaction, nonce, signature);
    await tx.wait();
    res.send({ txHash: tx.hash });
  } catch (err) {
    res.status(500).send({ error: err.toString() });
  }
});

app.listen(4000, () => console.log('Relayer listening on port 4000'));
