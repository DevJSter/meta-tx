const TokenVault = require('./tokenVault');

async function runTests() {
    const vault = new TokenVault('./test_vault.db');
    
    console.log('Running Token Vault Tests...\n');
    
    try {
        // Test 1: Create wallet from Aadhaar
        console.log('Test 1: Creating wallet from Aadhaar number');
        const aadhaar1 = '123456789012';
        const password1 = 'testPassword123';
        
        const wallet1 = await vault.createWalletFromAadhaar(aadhaar1, password1);
        console.log('✓ Wallet created successfully');
        console.log('  Address:', wallet1.walletAddress);
        
        // Test 2: Try to create duplicate wallet (should fail)
        console.log('\nTest 2: Attempting to create duplicate wallet');
        try {
            await vault.createWalletFromAadhaar(aadhaar1, password1);
            console.log('✗ Test failed - should not allow duplicate wallets');
        } catch (error) {
            console.log('✓ Correctly rejected duplicate wallet creation');
        }
        
        // Test 3: Retrieve wallet by Aadhaar
        console.log('\nTest 3: Retrieving wallet by Aadhaar number');
        const retrievedWallet = await vault.getWalletByAadhaar(aadhaar1);
        console.log('✓ Wallet retrieved successfully');
        console.log('  Address matches:', retrievedWallet.walletAddress === wallet1.walletAddress);
        
        // Test 4: Sign message
        console.log('\nTest 4: Signing message');
        const message = 'Test message for signing';
        const signResult = await vault.signMessage(aadhaar1, message, password1);
        console.log('✓ Message signed successfully');
        console.log('  Signature:', signResult.signature.substring(0, 20) + '...');
        
        // Test 5: Verify signature
        console.log('\nTest 5: Verifying signature');
        const isValid = await vault.verifySignature(
            signResult.walletAddress,
            message,
            signResult.signature
        );
        console.log('✓ Signature verification:', isValid ? 'VALID' : 'INVALID');
        
        // Test 6: Wrong password
        console.log('\nTest 6: Testing wrong password');
        try {
            await vault.signMessage(aadhaar1, message, 'wrongPassword');
            console.log('✗ Test failed - should reject wrong password');
        } catch (error) {
            console.log('✓ Correctly rejected wrong password');
        }
        
        // Test 7: Multiple signatures
        console.log('\nTest 7: Creating multiple signatures');
        await vault.signMessage(aadhaar1, 'Message 1', password1);
        await vault.signMessage(aadhaar1, 'Message 2', password1);
        await vault.signMessage(aadhaar1, 'Message 3', password1);
        
        const history = await vault.getSignatureHistory(aadhaar1);
        console.log('✓ Signature history retrieved:', history.length, 'signatures');
        
        // Test 8: Different Aadhaar numbers produce different wallets
        console.log('\nTest 8: Different Aadhaar numbers');
        const aadhaar2 = '987654321098';
        const wallet2 = await vault.createWalletFromAadhaar(aadhaar2, password1);
        console.log('✓ Different Aadhaar produces different wallet');
        console.log('  Wallets are different:', wallet1.walletAddress !== wallet2.walletAddress);
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        vault.close();
        
        // Clean up test database
        const fs = require('fs');
        try {
            fs.unlinkSync('./test_vault.db');
        } catch (err) {
            // Ignore cleanup errors
        }
    }
}

runTests();
