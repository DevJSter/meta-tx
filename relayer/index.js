const express = require('express');
const ethers = require('ethers');
const dotenv = require('dotenv');
const MetaTxInteraction = require('./MetaTxInteraction.json');
// Use global fetch if available (Node.js v18+), otherwise fallback to node-fetch
let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch {
  fetch = require('node-fetch');
}

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
  console.log('Received relayMetaTx request:', { user, interaction, nonce, signature });
  console.log(signature);

  // AI validation stub — replace with real AI check later
  // Acceptable interaction prefixes for a community aggregator platform
  const validPrefixes = [
    'liked_',
    'comment_',
    'share_',
    'reshare_',
    'post_',
    'community_post_',
    'group_post_',
    'reply_',
    'vote_',
    'follow_',
    'join_group_',
    'leave_group_'
  ];

  const isValidInteraction = validPrefixes.some(prefix => interaction.startsWith(prefix));
  console.log('Prefix validation result:', isValidInteraction);

  if (!isValidInteraction) {
    console.log('Interaction rejected by AI filter');
    return res.status(400).send({ error: 'Interaction rejected by AI filter' });
  }

  // Ollama llama3 AI validation
  try {
    console.log('Sending prompt to Ollama llama3...');
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: `Rate the significance of this interaction (from 0.0 to 1.0): "${interaction}". Respond with only a number.`,
        stream: false
      })
    });
    console.log('Ollama response status:', ollamaRes.status);
    const ollamaData = await ollamaRes.json();
    console.log('Ollama response data:', ollamaData);

    // Extract the number from the response
    const significance = parseFloat(ollamaData.response.match(/[\d.]+/)[0]);
    console.log('Extracted significance:', significance);

    if (isNaN(significance) || significance < 0.5) {
      console.log('Interaction not significant enough:', significance);
      return res.status(400).send({ error: 'Interaction not significant enough', significance });
    }
  } catch (e) {
    console.error('AI validation failed:', e);
    return res.status(500).send({ error: 'AI validation failed', details: e.toString() });
  }

  try {
    console.log('Sending transaction to contract...');

    const tx = await contract.executeMetaTx(user, interaction, nonce, signature);
    console.log('Transaction sent. Waiting for confirmation...', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed:', tx.hash);
    res.send({ txHash: tx.hash });
  } catch (err) {
    console.error('Contract execution failed:', err);
    res.status(500).send({ error: err.toString() });
  }
});

app.listen(4000, () => console.log('Relayer listening on port 4000'));
