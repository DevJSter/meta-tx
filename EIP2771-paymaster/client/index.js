const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABIs (simplified)
const FORWARDER_ABI = [
    "function getNonce(address from) view returns (uint256)",
    "function verify(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) view returns (bool)",
    "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)"
];

const PAYMASTER_ABI = [
    "function sponsorTransaction(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) returns (bool, bytes)",
    "function depositCredits(address user) payable",
    "function userCredits(address user) view returns (uint256)",
    "function getEstimatedFee(uint256 gasLimit) view returns (uint256)",
    "function canAffordTransaction(address user, uint256 gasLimit) view returns (bool)"
];

const SAMPLE_CONTRACT_ABI = [
    "function updateBalance(uint256 amount)",
    "function setMessage(string message)",
    "function getBalance(address user) view returns (uint256)",
    "function getMessage(address user) view returns (string)"
];

class MetaTransactionClient {
    constructor(providerUrl, privateKey, forwarderAddress, paymasterAddress, sampleContractAddress) {
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.forwarderAddress = forwarderAddress;
        this.paymasterAddress = paymasterAddress;
        this.sampleContractAddress = sampleContractAddress;
        
        this.forwarder = new ethers.Contract(forwarderAddress, FORWARDER_ABI, this.wallet);
        this.paymaster = new ethers.Contract(paymasterAddress, PAYMASTER_ABI, this.wallet);
        this.sampleContract = new ethers.Contract(sampleContractAddress, SAMPLE_CONTRACT_ABI, this.wallet);
        
        // EIP-712 domain
        this.domain = {
            name: "MinimalForwarder",
            version: "0.0.1",
            chainId: process.env.CHAIN_ID || 31337,
            verifyingContract: forwarderAddress
        };
        
        this.types = {
            ForwardRequest: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "gas", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "data", type: "bytes" }
            ]
        };
    }
    
    async createForwardRequest(to, data, value = 0, gas = 200000) {
        const from = this.wallet.address;
        const nonce = await this.forwarder.getNonce(from);
        
        return {
            from,
            to,
            value,
            gas,
            nonce,
            data
        };
    }
    
    async signForwardRequest(request) {
        const signature = await this.wallet.signTypedData(this.domain, this.types, request);
        return signature;
    }
    
    async executeMetaTransaction(to, data, value = 0, gas = 200000) {
        try {
            console.log("Creating forward request...");
            const request = await this.createForwardRequest(to, data, value, gas);
            
            console.log("Signing request...");
            const signature = await this.signForwardRequest(request);
            
            console.log("Verifying signature...");
            const isValid = await this.forwarder.verify(request, signature);
            if (!isValid) {
                throw new Error("Invalid signature");
            }
            
            console.log("Executing via paymaster...");
            const tx = await this.paymaster.sponsorTransaction(request, signature);
            const receipt = await tx.wait();
            
            console.log("Transaction successful:", receipt.hash);
            return receipt;
        } catch (error) {
            console.error("Error executing meta transaction:", error);
            throw error;
        }
    }
    
    async depositCredits(amount) {
        console.log(`Depositing ${ethers.formatEther(amount)} ETH as credits...`);
        const tx = await this.paymaster.depositCredits(this.wallet.address, { value: amount });
        const receipt = await tx.wait();
        console.log("Credits deposited:", receipt.hash);
        return receipt;
    }
    
    async getCredits() {
        const credits = await this.paymaster.userCredits(this.wallet.address);
        return credits;
    }
    
    async getEstimatedFee(gasLimit) {
        const fee = await this.paymaster.getEstimatedFee(gasLimit);
        return fee;
    }
    
    async canAffordTransaction(gasLimit) {
        const canAfford = await this.paymaster.canAffordTransaction(this.wallet.address, gasLimit);
        return canAfford;
    }
    
    // Sample contract interactions
    async updateBalanceViaMeta(amount) {
        const data = this.sampleContract.interface.encodeFunctionData("updateBalance", [amount]);
        return this.executeMetaTransaction(this.sampleContractAddress, data);
    }
    
    async setMessageViaMeta(message) {
        const data = this.sampleContract.interface.encodeFunctionData("setMessage", [message]);
        return this.executeMetaTransaction(this.sampleContractAddress, data);
    }
    
    async getBalance() {
        const balance = await this.sampleContract.getBalance(this.wallet.address);
        return balance;
    }
    
    async getMessage() {
        const message = await this.sampleContract.getMessage(this.wallet.address);
        return message;
    }
}

// Example usage
async function main() {
    try {
        const client = new MetaTransactionClient(
            process.env.RPC_URL || "http://localhost:8545",
            process.env.PRIVATE_KEY,
            process.env.FORWARDER_ADDRESS,
            process.env.PAYMASTER_ADDRESS,
            process.env.SAMPLE_CONTRACT_ADDRESS
        );
        
        console.log("=== EIP2771 Paymaster Meta-Transaction Demo ===");
        console.log("Wallet address:", client.wallet.address);
        
        // Check current credits
        const credits = await client.getCredits();
        console.log("Current credits:", ethers.formatEther(credits), "ETH");
        
        // Deposit credits if needed
        if (credits < ethers.parseEther("0.01")) {
            console.log("Depositing credits...");
            await client.depositCredits(ethers.parseEther("0.1"));
        }
        
        // Check if can afford transaction
        const gasLimit = 200000;
        const canAfford = await client.canAffordTransaction(gasLimit);
        console.log("Can afford transaction:", canAfford);
        
        if (canAfford) {
            // Get estimated fee
            const estimatedFee = await client.getEstimatedFee(gasLimit);
            console.log("Estimated fee:", ethers.formatEther(estimatedFee), "ETH");
            
            // Execute meta-transaction to update balance
            console.log("\n=== Executing Meta-Transaction ===");
            await client.updateBalanceViaMeta(42);
            
            // Check result
            const balance = await client.getBalance();
            console.log("New balance:", balance.toString());
            
            // Execute meta-transaction to set message
            await client.setMessageViaMeta("Hello from meta-transaction!");
            
            // Check result
            const message = await client.getMessage();
            console.log("Message:", message);
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { MetaTransactionClient };