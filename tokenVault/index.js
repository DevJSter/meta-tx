const TokenVault = require('./tokenVault');

async function main() {
    const vault = new TokenVault();
    
    try {
        console.log('=== Token Vault Demo ===\n');
        
        // Example Aadhaar number (12 digits)
        const aadhaarNumber = '123456789012';
        const password = 'securePassword123';
        
        console.log('1. Creating wallet from Aadhaar number...');
        const wallet = await vault.createWalletFromAadhaar(aadhaarNumber, password);
        console.log('Wallet created successfully!');
        console.log('Wallet Address:', wallet.walletAddress);
        console.log('Public Key:', wallet.publicKey);
        console.log('Aadhaar Hash:', wallet.aadhaarHash);
        console.log('');
        
        console.log('2. Retrieving wallet by Aadhaar number...');
        const retrievedWallet = await vault.getWalletByAadhaar(aadhaarNumber);
        console.log('Retrieved wallet:', retrievedWallet);
        console.log('');
        
        console.log('3. Signing a message...');
        const message = 'Hello, this is a test message for signing!';
        const signResult = await vault.signMessage(aadhaarNumber, message, password);
        console.log('Message signed successfully!');
        console.log('Message:', message);
        console.log('Message Hash:', signResult.messageHash);
        console.log('Signature:', signResult.signature);
        console.log('');
        
        console.log('4. Verifying signature...');
        const isValid = await vault.verifySignature(
            signResult.walletAddress,
            message,
            signResult.signature
        );
        console.log('Signature valid:', isValid);
        console.log('');
        
        console.log('5. Getting signature history...');
        const history = await vault.getSignatureHistory(aadhaarNumber);
        console.log('Signature history:', history);
        console.log('');
        
        console.log('Demo completed successfully!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        vault.close();
    }
}

// Run the demo
main();
