require('dotenv').config();
const express = require('express');
const cors = require('cors');
const RelayerService = require('./src/relayer-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize relayer service
const relayerService = new RelayerService();

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'QOBI Relayer System API',
    version: '1.0.0',
    endpoints: {
      '/status': 'GET - Service status and statistics',
      '/transactions': 'POST - Submit transaction for processing',
      '/transactions/:id/relay': 'POST - Relay a validated transaction',
      '/batches': 'GET - Recent processed batches',
      '/merkle/:batchId': 'GET - Merkle tree data for batch',
      '/ai/status': 'GET - AI validator status'
    }
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    stats: relayerService.getStats(),
    timestamp: new Date().toISOString()
  });
});

app.post('/transactions', async (req, res) => {
  try {
    const { from, to, value, data, gasLimit, gasPrice } = req.body;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to addresses are required' });
    }

    const txId = await relayerService.addTransaction({
      from,
      to,
      value: value || '0',
      data: data || '0x',
      gasLimit: gasLimit || '21000',
      gasPrice
    });

    res.json({
      success: true,
      transactionId: txId,
      status: 'queued'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/transactions/:id/relay', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await relayerService.relayTransaction(id);
    
    res.json({
      success: true,
      txHash: result.txHash,
      signature: result.signature,
      merkleProof: result.merkleProof
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/batches', (req, res) => {
  const count = parseInt(req.query.count) || 10;
  res.json({
    batches: relayerService.getRecentBatches(count)
  });
});

app.get('/merkle/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batches = relayerService.getRecentBatches(100);
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  res.json({
    batchId: batch.id,
    merkleRoot: batch.merkleRoot,
    merkleLeaves: batch.merkleLeaves,
    transactionCount: batch.transactions.length
  });
});

app.get('/ai/status', async (req, res) => {
  try {
    const status = await relayerService.aiValidator.testConnection();
    const stats = relayerService.aiValidator.getValidationStats();
    
    res.json({
      connection: status,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    await relayerService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🌐 QOBI Relayer API server running on port ${PORT}`);
      console.log(`📖 API documentation available at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await relayerService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await relayerService.shutdown();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
