const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

// Contract ABIs
const FORWARDER_ABI = [
    "function getNonce(address from) view returns (uint256)",
    "function verifySignature(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) view returns (bool)",
    "function executeMetaTransaction(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)",
    "function executeSponsoredTransaction(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature, address paymaster) returns (bool, bytes)"
];

const PAYMASTER_ABI = [
    "function sponsorTransaction(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)",
    "function canAffordTransaction(address user, uint256 gasLimit) view returns (bool)",
    "function canSponsorTransaction(address user, address target, uint256 gasLimit) view returns (bool)"
];

class SimpleRelayerService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
        this.wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, this.provider);
        
        // Contract instances
        this.forwarder = new ethers.Contract(
            process.env.FORWARDER_ADDRESS,
            FORWARDER_ABI,
            this.wallet
        );
        
        this.paymaster = new ethers.Contract(
            process.env.PAYMASTER_ADDRESS,
            PAYMASTER_ABI,
            this.wallet
        );
    }
    
    /**
     * Option 1: Direct forwarder execution (relayer pays gas)
     */
    async relayWithRelayerFunding(request, signature) {
        try {
            // Verify the request
            const isValid = await this.forwarder.verifySignature(request, signature);
            if (!isValid) {
                throw new Error("Invalid signature");
            }
            
            // Execute directly through forwarder (relayer pays gas)
            const tx = await this.forwarder.executeMetaTransaction(request, signature);
            const receipt = await tx.wait();
            
            return {
                success: true,
                hash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                method: "relayer-funded"
            };
        } catch (error) {
            console.error("Relay error:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Option 2: Paymaster execution (owner's deposited funds pay gas)
     */
    async relayWithPaymasterFunding(request, signature) {
        try {
            // Check if transaction can be afforded by paymaster
            const canAfford = await this.paymaster.canAffordTransaction(request.from, request.gas);
            if (!canAfford) {
                throw new Error("Paymaster cannot afford transaction");
            }
            
            // Execute via paymaster (owner's funds pay gas)
            const tx = await this.paymaster.sponsorTransaction(request, signature);
            const receipt = await tx.wait();
            
            return {
                success: true,
                hash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                method: "paymaster-funded"
            };
        } catch (error) {
            console.error("Paymaster relay error:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getNonce(address) {
        return await this.forwarder.getNonce(address);
    }
    
    async getPaymasterBalance() {
        return await this.provider.getBalance(this.paymaster.address);
    }
}

const relayerService = new SimpleRelayerService();

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get nonce for address
app.get('/nonce/:address', async (req, res) => {
    try {
        const nonce = await relayerService.getNonce(req.params.address);
        res.json({ nonce: nonce.toString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get paymaster balance
app.get('/paymaster/balance', async (req, res) => {
    try {
        const balance = await relayerService.getPaymasterBalance();
        res.json({ balance: ethers.formatEther(balance) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Relay transaction with relayer funding
app.post('/relay/relayer-funded', async (req, res) => {
    try {
        const { request, signature } = req.body;
        const result = await relayerService.relayWithRelayerFunding(request, signature);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Relay transaction with paymaster funding
app.post('/relay/paymaster-funded', async (req, res) => {
    try {
        const { request, signature } = req.body;
        const result = await relayerService.relayWithPaymasterFunding(request, signature);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Simple Relayer Service running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  GET  /nonce/:address - Get nonce for address');
    console.log('  GET  /paymaster/balance - Get paymaster balance');
    console.log('  POST /relay/relayer-funded - Relay with relayer paying gas');
    console.log('  POST /relay/paymaster-funded - Relay with paymaster paying gas');
});

module.exports = { SimpleRelayerService };
