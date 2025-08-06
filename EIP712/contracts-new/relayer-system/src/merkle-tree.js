const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { ethers } = require('ethers');

class QOBIMerkleTree {
  constructor() {
    this.leaves = [];
    this.tree = null;
  }

  addLeaf(data) {
    // Create a standardized leaf hash
    const leafData = typeof data === 'string' ? data : JSON.stringify(data);
    const leaf = keccak256(leafData);
    this.leaves.push(leaf);
    return leaf;
  }

  addTransaction(tx) {
    const txData = {
      from: tx.from,
      to: tx.to,
      value: tx.value,
      data: tx.data || '0x',
      timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
      nonce: tx.nonce || Date.now()
    };
    return this.addLeaf(txData);
  }

  addAIValidation(validation) {
    const validationData = {
      validatorId: validation.validatorId,
      confidence: validation.confidence,
      riskScore: validation.riskScore,
      metadata: validation.metadata,
      timestamp: Math.floor(Date.now() / 1000)
    };
    return this.addLeaf(validationData);
  }

  buildTree() {
    if (this.leaves.length === 0) {
      throw new Error('No leaves to build tree from');
    }
    
    this.tree = new MerkleTree(this.leaves, keccak256, { sortPairs: true });
    return this.tree;
  }

  getRoot() {
    if (!this.tree) {
      this.buildTree();
    }
    return '0x' + this.tree.getRoot().toString('hex');
  }

  getProof(leaf) {
    if (!this.tree) {
      this.buildTree();
    }
    
    const proof = this.tree.getProof(leaf);
    return proof.map(x => '0x' + x.data.toString('hex'));
  }

  getHexProof(leaf) {
    return this.tree.getHexProof(leaf);
  }

  verify(proof, leaf, root) {
    return MerkleTree.verify(proof, leaf, root, keccak256, { sortPairs: true });
  }

  // Generate a batch of transactions for testing
  generateTestBatch(count = 10) {
    const batch = [];
    for (let i = 0; i < count; i++) {
      const tx = {
        from: ethers.Wallet.createRandom().address,
        to: ethers.Wallet.createRandom().address,
        value: Math.random() * 10,
        data: '0x' + Math.random().toString(16).slice(2, 18),
        timestamp: Math.floor(Date.now() / 1000) + i,
        nonce: Date.now() + i
      };
      batch.push(tx);
      this.addTransaction(tx);
    }
    return batch;
  }

  // Get tree statistics
  getStats() {
    return {
      leafCount: this.leaves.length,
      depth: this.tree ? this.tree.getDepth() : 0,
      root: this.getRoot(),
      layerCount: this.tree ? this.tree.getLayerCount() : 0
    };
  }

  // Export tree data
  export() {
    return {
      leaves: this.leaves.map(leaf => '0x' + leaf.toString('hex')),
      root: this.getRoot(),
      tree: this.tree ? this.tree.toString() : null
    };
  }

  // Import tree data
  import(data) {
    this.leaves = data.leaves.map(leaf => Buffer.from(leaf.slice(2), 'hex'));
    this.buildTree();
  }
}

module.exports = QOBIMerkleTree;