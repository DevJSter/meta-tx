require('dotenv').config();
const QOBIMerkleTree = require('./src/merkle-tree');
const chalk = require('chalk');

async function runMerkleDemo() {
  console.log(chalk.blue.bold('\n🌳 QOBI Merkle Tree Demo\n'));

  // Create a new merkle tree
  const merkleTree = new QOBIMerkleTree();

  // Generate some test transactions
  console.log(chalk.yellow('📝 Generating test transactions...'));
  const transactions = merkleTree.generateTestBatch(10);
  
  transactions.forEach((tx, index) => {
    console.log(chalk.cyan(`${index + 1}. ${tx.from} → ${tx.to} (${tx.value} ETH)`));
  });

  // Build the merkle tree
  console.log(chalk.yellow('\n🔨 Building Merkle Tree...'));
  merkleTree.buildTree();

  // Get tree statistics
  const stats = merkleTree.getStats();
  console.log(chalk.green(`\n📊 Tree Statistics:`));
  console.log(chalk.blue(`   Leaves: ${stats.leafCount}`));
  console.log(chalk.blue(`   Depth: ${stats.depth}`));
  console.log(chalk.blue(`   Root: ${stats.root}`));
  console.log(chalk.blue(`   Layers: ${stats.layerCount}`));

  // Demonstrate proof generation and verification
  console.log(chalk.yellow('\n🔍 Demonstrating Merkle Proofs...'));
  
  const firstLeaf = merkleTree.leaves[0];
  const proof = merkleTree.getProof(firstLeaf);
  const root = merkleTree.getRoot();
  
  console.log(chalk.cyan(`   First Leaf: 0x${firstLeaf.toString('hex')}`));
  console.log(chalk.cyan(`   Proof Length: ${proof.length} nodes`));
  console.log(chalk.cyan(`   Proof: ${JSON.stringify(proof, null, 2)}`));

  // Verify the proof
  const isValid = merkleTree.verify(proof, firstLeaf, root);
  console.log(chalk.green(`   Verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`));

  // Add some AI validations
  console.log(chalk.yellow('\n🤖 Adding AI Validations...'));
  
  const aiValidations = [
    {
      validatorId: 'ollama-llama3.2',
      confidence: 95,
      riskScore: 15,
      metadata: 'Low risk transaction detected'
    },
    {
      validatorId: 'ollama-llama3.2',
      confidence: 87,
      riskScore: 45,
      metadata: 'Medium risk - unusual amount pattern'
    },
    {
      validatorId: 'ollama-llama3.2',
      confidence: 92,
      riskScore: 80,
      metadata: 'High risk - suspicious contract interaction'
    }
  ];

  aiValidations.forEach((validation, index) => {
    merkleTree.addAIValidation(validation);
    console.log(chalk.cyan(`${index + 1}. Risk: ${validation.riskScore}% | Confidence: ${validation.confidence}%`));
  });

  // Rebuild tree with new data
  merkleTree.buildTree();
  const newStats = merkleTree.getStats();
  
  console.log(chalk.green(`\n📊 Updated Tree Statistics:`));
  console.log(chalk.blue(`   Total Leaves: ${newStats.leafCount}`));
  console.log(chalk.blue(`   New Root: ${newStats.root}`));

  // Export tree data
  console.log(chalk.yellow('\n💾 Exporting Tree Data...'));
  const exportData = merkleTree.export();
  console.log(chalk.cyan(`   Exported ${exportData.leaves.length} leaves`));
  console.log(chalk.cyan(`   Root: ${exportData.root}`));

  // Demonstrate importing
  console.log(chalk.yellow('\n📥 Testing Import/Export...'));
  const newTree = new QOBIMerkleTree();
  newTree.import(exportData);
  
  const importedStats = newTree.getStats();
  console.log(chalk.green(`   Imported successfully: ${importedStats.leafCount} leaves`));
  console.log(chalk.green(`   Roots match: ${importedStats.root === newStats.root ? '✅' : '❌'}`));

  console.log(chalk.green.bold('\n🎉 Merkle Tree Demo Complete!\n'));
}

if (require.main === module) {
  runMerkleDemo().catch(console.error);
}

module.exports = { runMerkleDemo };
