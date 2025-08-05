const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Simple contract verification and Merkle tree demo
 */
async function testContracts() {
    console.log('🔍 Testing Contract Connections...\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`Provider: ${process.env.RPC_URL}`);
    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);
    
    // Test each contract address
    const contracts = {
        'SystemDeployer': process.env.SYSTEM_DEPLOYER_ADDRESS,
        'AccessControl': process.env.ACCESS_CONTROL_ADDRESS,  
        'DailyTree': process.env.DAILY_TREE_ADDRESS,
        'MerkleDistributor': process.env.MERKLE_DISTRIBUTOR_ADDRESS,
        'StabilizingContract': process.env.STABILIZING_CONTRACT_ADDRESS,
        'RelayerTreasury': process.env.RELAYER_TREASURY_ADDRESS
    };
    
    console.log('\n📋 Contract Addresses:');
    for (const [name, address] of Object.entries(contracts)) {
        const code = await provider.getCode(address);
        const hasCode = code !== '0x';
        console.log(`   ${hasCode ? '✅' : '❌'} ${name}: ${address} ${hasCode ? '(deployed)' : '(no code)'}`);
    }
    
    // Test simple Merkle tree creation and submission bypassing permissions
    console.log('\n🌳 Creating Simple Merkle Tree Demo...');
    
    // Mock user data
    const users = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222', 
        '0x3333333333333333333333333333333333333333'
    ];
    
    const amounts = [
        ethers.parseEther('1.0').toString(),
        ethers.parseEther('0.5').toString(),
        ethers.parseEther('0.25').toString()
    ];
    
    console.log('\n👥 Demo Users:');
    users.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user} → ${ethers.formatEther(amounts[i])} QOBI`);
    });
    
    // Create leaves for Merkle tree
    const leaves = users.map((user, i) => {
        return ethers.keccak256(
            ethers.solidityPacked(
                ['address', 'uint256'],
                [user, amounts[i]]
            )
        );
    });
    
    console.log('\n🍃 Merkle Leaves:');
    leaves.forEach((leaf, i) => {
        console.log(`   ${i + 1}. ${leaf}`);
    });
    
    // Simple Merkle root calculation (for demo)
    let merkleRoot;
    if (leaves.length === 1) {
        merkleRoot = leaves[0];
    } else if (leaves.length === 2) {
        merkleRoot = ethers.keccak256(ethers.concat([leaves[0], leaves[1]]));
    } else {
        // For 3 leaves: hash(hash(leaf1, leaf2), leaf3)
        const pair1 = ethers.keccak256(ethers.concat([leaves[0], leaves[1]]));
        merkleRoot = ethers.keccak256(ethers.concat([pair1, leaves[2]]));
    }
    
    console.log(`\n🌳 Merkle Root: ${merkleRoot}`);
    
    // Try to get current day from contract
    console.log('\n📅 Testing Contract Calls...');
    
    try {
        const dailyTreeABI = [
            "function getCurrentDay() view returns (uint256)",
            "function dailyLimits(uint256) view returns (uint256, uint256)"
        ];
        
        const dailyTreeContract = new ethers.Contract(
            process.env.DAILY_TREE_ADDRESS,
            dailyTreeABI,
            provider
        );
        
        const currentDay = await dailyTreeContract.getCurrentDay();
        console.log(`✅ Current Day: ${currentDay}`);
        
        // Check daily limits for CREATE interactions
        const limits = await dailyTreeContract.dailyLimits(0);
        console.log(`✅ CREATE limits: ${limits[0]} users, ${ethers.formatEther(limits[1])} QOBI cap`);
        
    } catch (error) {
        console.log(`❌ Contract call failed: ${error.message}`);
    }
    
    // Show what a successful Merkle tree submission would look like
    console.log('\n📋 Merkle Tree Submission Structure:');
    console.log('=====================================');
    console.log(`Day: ${Math.floor(Date.now() / 86400000)}`);
    console.log(`Interaction Type: 0 (CREATE)`);
    console.log(`Merkle Root: ${merkleRoot}`);
    console.log(`Users: [${users.join(', ')}]`);
    console.log(`Amounts: [${amounts.map(a => ethers.formatEther(a) + ' QOBI').join(', ')}]`);
    console.log(`Total QOBI: ${ethers.formatEther(amounts.reduce((sum, amount) => sum + BigInt(amount), 0n))} QOBI`);
    
    // Show claim process
    console.log('\n💰 Token Claiming Process:');
    console.log('==========================');
    console.log('1. User calls: MerkleDistributor.claim(day, interactionType, amount, merkleProof)');
    console.log('2. Contract verifies proof against stored Merkle root');
    console.log('3. If valid, QOBI tokens are minted to user');
    console.log('4. User can only claim once per day per interaction type');
    
    console.log('\n🎯 Demo Complete!');
    console.log('The system is designed to:');
    console.log('• Validate social interactions with AI');
    console.log('• Build efficient Merkle trees for gas optimization');  
    console.log('• Submit daily roots with EIP712 signatures');
    console.log('• Enable users to claim rewards with Merkle proofs');
}

if (require.main === module) {
    testContracts().catch(console.error);
}

module.exports = { testContracts };
