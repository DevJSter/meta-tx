const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

// Contract ABIs
const FORWARDER_ABI = [
    "function getNonce(address from) view returns (uint256)",
    "function verify(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) view returns (bool)",
    "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)"
];

const PAYMASTER_ABI = [
    "function sponsorTransaction(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)",
    "function canAffordTransaction(address user, uint256 gasLimit) view returns (bool)"
];

class RelayerService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, this.provider);
        this.forwarder = new ethers.Contract(process.env.FORWARDER_ADDRESS, FORWARDER_ABI, this.wallet);
        this.paymaster = new ethers.Contract(process.env.PAYMASTER_ADDRESS, PAYMASTER_ABI, this.wallet);
    }
    
    async relayTransaction(request, signature) {
        try {
            // Verify the request
            const isValid = await this.forwarder.verify(request, signature);
            if (!isValid) {
                throw new Error("Invalid signature");
            }
            
            // Check if user can afford the transaction
            const canAfford = await this.paymaster.canAffordTransaction(request.from, request.gas);
            if (!canAfford) {
                throw new Error("User cannot afford transaction");
            }
            
            // Execute via paymaster
            const tx = await this.paymaster.sponsorTransaction(request, signature);
            const receipt = await tx.wait();
            
            return {
                success: true,
                hash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            };
        } catch (error) {
            console.error("Relay error:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getNonce(address) {
        return await this.forwarder.getNonce(address);
    }
}

const relayer = new RelayerService();

// API Routes
app.post('/relay', async (req, res) => {
    try {
        const { request, signature } = req.body;
        
        if (!request || !signature) {
            return res.status(400).json({ error: "Missing request or signature" });
        }
        
        const result = await relayer.relayTransaction(request, signature);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/nonce/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const nonce = await relayer.getNonce(address);
        res.json({ nonce: nonce.toString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Relayer service running on port ${PORT}`);
    console.log(`Forwarder: ${process.env.FORWARDER_ADDRESS}`);
    console.log(`Paymaster: ${process.env.PAYMASTER_ADDRESS}`);
    console.log(`Relayer wallet: ${relayer.wallet.address}`);
});

module.exports = { RelayerService };
