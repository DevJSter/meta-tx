const { ethers } = require('ethers');
const EIP712Signer = require('./eip712-signer');
const AIValidator = require('./ai-validator');
const QOBIMerkleTree = require('./merkle-tree');

class RelayerService {
  constructor(config = {}) {
    this.config = {
      rpcUrl: config.rpcUrl || process.env.RPC_URL,
      privateKey: config.privateKey || process.env.PRIVATE_KEY,
      chainId: config.chainId || parseInt(process.env.CHAIN_ID) || 202102,
      batchSize: config.batchSize || parseInt(process.env.BATCH_SIZE) || 100,
      processingInterval: config.processingInterval || parseInt(process.env.PROCESSING_INTERVAL) || 10000,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_URL,
      ollamaModel: config.ollamaModel || process.env.OLLAMA_MODEL,
      ...config
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.signer = new EIP712Signer(this.config.privateKey, this.config.chainId);
    this.aiValidator = new AIValidator(this.config.ollamaUrl, this.config.ollamaModel);
    this.merkleTree = new QOBIMerkleTree();

    this.pendingTransactions = [];
    this.processedBatches = [];
    this.isProcessing = false;
    this.stats = {
      totalProcessed: 0,
      totalValidated: 0,
      totalRelayed: 0,
      averageProcessingTime: 0,
      errorCount: 0
    };

    // Contract addresses
    this.contracts = {
      systemDeployer: config.systemDeployer || process.env.SYSTEM_DEPLOYER_ADDRESS,
      accessControl: config.accessControl || process.env.ACCESS_CONTROL_ADDRESS,
      dailyTree: config.dailyTree || process.env.DAILY_TREE_ADDRESS,
      merkleDistributor: config.merkleDistributor || process.env.MERKLE_DISTRIBUTOR_ADDRESS,
      stabilizingContract: config.stabilizingContract || process.env.STABILIZING_CONTRACT_ADDRESS,
      relayerTreasury: config.relayerTreasury || process.env.RELAYER_TREASURY_ADDRESS
    };
  }

  async initialize() {
    console.log('🚀 Initializing QOBI Relayer Service...');
    
    // Test connections
    await this.testConnections();
    
    // Start processing loop
    this.startProcessing();
    
    console.log('✅ Relayer Service initialized successfully');
  }

  async testConnections() {
    try {
      // Test blockchain connection
      const network = await this.provider.getNetwork();
      console.log(`📡 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

      // Test AI validator connection
      const aiStatus = await this.aiValidator.testConnection();
      if (aiStatus.connected) {
        console.log(`🤖 AI Validator connected: ${this.config.ollamaModel}`);
      } else {
        console.warn(`⚠️ AI Validator connection failed: ${aiStatus.error}`);
      }

      // Test wallet
      const wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      const balance = await wallet.provider.getBalance(wallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

    } catch (error) {
      console.error('❌ Connection test failed:', error);
      throw error;
    }
  }

  async addTransaction(tx) {
    // Validate required fields
    if (!tx.from || !tx.to) {
      throw new Error('Transaction must have from and to addresses');
    }

    const transaction = {
      id: this.generateTransactionId(),
      from: tx.from,
      to: tx.to,
      value: tx.value || '0',
      data: tx.data || '0x',
      gasLimit: tx.gasLimit || '21000',
      gasPrice: tx.gasPrice,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
      ...tx
    };

    this.pendingTransactions.push(transaction);
    console.log(`📝 Added transaction ${transaction.id} to queue`);
    
    return transaction.id;
  }

  async processBatch() {
    if (this.isProcessing || this.pendingTransactions.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Take a batch of transactions
      const batchSize = Math.min(this.config.batchSize, this.pendingTransactions.length);
      const batch = this.pendingTransactions.splice(0, batchSize);
      
      console.log(`🔄 Processing batch of ${batch.length} transactions...`);

      // AI Validation
      const validations = await this.aiValidator.batchValidate(batch);
      
      // Add to merkle tree
      const merkleLeaves = [];
      for (let i = 0; i < batch.length; i++) {
        const tx = batch[i];
        const validation = validations[i];
        
        // Create merkle leaf data
        const leafData = {
          tx,
          validation,
          batchId: this.generateBatchId(),
          timestamp: Date.now()
        };
        
        const leaf = this.merkleTree.addLeaf(leafData);
        merkleLeaves.push({ leaf, data: leafData });
        
        // Update transaction status
        tx.status = validation.riskScore > 70 ? 'rejected' : 'validated';
        tx.validation = validation;
      }

      // Build merkle tree and get root
      const merkleRoot = this.merkleTree.getRoot();
      
      // Create batch record
      const batchRecord = {
        id: this.generateBatchId(),
        transactions: batch,
        validations,
        merkleRoot,
        merkleLeaves: merkleLeaves.map(item => ({
          leaf: '0x' + item.leaf.toString('hex'),
          txId: item.data.tx.id
        })),
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        stats: {
          total: batch.length,
          validated: batch.filter(tx => tx.status === 'validated').length,
          rejected: batch.filter(tx => tx.status === 'rejected').length
        }
      };

      this.processedBatches.push(batchRecord);
      
      // Update stats
      this.updateStats(batchRecord);
      
      console.log(`✅ Batch ${batchRecord.id} processed successfully`);
      console.log(`📊 Stats: ${batchRecord.stats.validated} validated, ${batchRecord.stats.rejected} rejected`);
      console.log(`🌳 Merkle Root: ${merkleRoot}`);

      return batchRecord;

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      this.stats.errorCount++;
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  startProcessing() {
    console.log(`🔄 Starting batch processing (interval: ${this.config.processingInterval}ms)`);
    
    setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('Processing interval error:', error);
      }
    }, this.config.processingInterval);
  }

  async relayTransaction(txId) {
    // Find the transaction in processed batches
    let transaction = null;
    let batchRecord = null;

    for (const batch of this.processedBatches) {
      const found = batch.transactions.find(tx => tx.id === txId);
      if (found) {
        transaction = found;
        batchRecord = batch;
        break;
      }
    }

    if (!transaction) {
      throw new Error(`Transaction ${txId} not found in processed batches`);
    }

    if (transaction.status !== 'validated') {
      throw new Error(`Transaction ${txId} is not validated (status: ${transaction.status})`);
    }

    try {
      // Create EIP-712 signed message
      const typedMessage = this.signer.createTypedMessage(
        transaction.from,
        transaction.to,
        transaction.value,
        transaction.data,
        transaction.validation
      );

      const signature = await this.signer.signQOBIMessage(typedMessage);

      // Submit to blockchain
      const wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      const txResponse = await wallet.sendTransaction({
        to: transaction.to,
        value: ethers.parseEther(transaction.value.toString()),
        data: transaction.data,
        gasLimit: transaction.gasLimit
      });

      console.log(`🚀 Transaction relayed: ${txResponse.hash}`);
      
      // Update transaction record
      transaction.status = 'relayed';
      transaction.txHash = txResponse.hash;
      transaction.signature = signature;
      transaction.relayedAt = new Date();

      this.stats.totalRelayed++;

      return {
        txHash: txResponse.hash,
        signature,
        merkleProof: this.merkleTree.getProof(
          Buffer.from(batchRecord.merkleLeaves.find(item => item.txId === txId).leaf.slice(2), 'hex')
        )
      };

    } catch (error) {
      console.error(`❌ Failed to relay transaction ${txId}:`, error);
      transaction.status = 'failed';
      transaction.error = error.message;
      throw error;
    }
  }

  generateTransactionId() {
    return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  updateStats(batchRecord) {
    this.stats.totalProcessed += batchRecord.stats.total;
    this.stats.totalValidated += batchRecord.stats.validated;
    
    // Update average processing time
    const totalBatches = this.processedBatches.length;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (totalBatches - 1) + batchRecord.processingTime) / totalBatches;
  }

  getStats() {
    return {
      ...this.stats,
      pendingTransactions: this.pendingTransactions.length,
      processedBatches: this.processedBatches.length,
      merkleTreeStats: this.merkleTree.getStats(),
      aiValidatorStats: this.aiValidator.getValidationStats()
    };
  }

  getRecentBatches(count = 10) {
    return this.processedBatches.slice(-count);
  }

  async shutdown() {
    console.log('🛑 Shutting down Relayer Service...');
    this.isProcessing = false;
    // Process any remaining transactions
    if (this.pendingTransactions.length > 0) {
      console.log(`🔄 Processing ${this.pendingTransactions.length} remaining transactions...`);
      await this.processBatch();
    }
    console.log('✅ Relayer Service shutdown complete');
  }
}

module.exports = RelayerService;
