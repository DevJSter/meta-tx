import { TokenVaultApp } from './index';
import { WalletResponse } from './types';

async function runTests() {
  console.log('Starting TypeScript Token Vault Tests...\n');
  
  const app = new TokenVaultApp('./test_vault.db');

  try {
    // Test 1: Process Aadhaar number (create new wallet)
    console.log('Test 1: Processing Aadhaar number (new wallet)');
    const aadhaar1 = '123456789012';
    const wallet1 = await app.processAadhaarNumber(aadhaar1);
    console.log('PASS: New wallet created');
    console.log(`   Aadhaar: ${wallet1.aadhaarNumber}`);
    console.log(`   Address: ${wallet1.walletAddress}`);
    console.log(`   Public Key: ${wallet1.publicKey.substring(0, 20)}...`);
    console.log(`   Private Key: ${wallet1.privateKey.substring(0, 20)}...`);
    console.log(`   Signature Hash: ${wallet1.signatureHash.substring(0, 20)}...`);
    console.log(`   Timestamp: ${new Date(wallet1.timestamp).toISOString()}`);

    // Test 2: Process same Aadhaar number (should return existing wallet)
    console.log('\nTest 2: Processing same Aadhaar number (existing wallet)');
    const wallet1Again = await app.processAadhaarNumber(aadhaar1);
    console.log('PASS: Existing wallet returned');
    console.log(`   Same address: ${wallet1.walletAddress === wallet1Again.walletAddress}`);
    console.log(`   Same timestamp: ${wallet1.timestamp === wallet1Again.timestamp}`);

    // Test 3: Check wallet existence
    console.log('\nTest 3: Checking wallet existence');
    const exists = await app.hasWallet(aadhaar1);
    const notExists = await app.hasWallet('999999999999');
    console.log(`PASS: Wallet exists for ${aadhaar1}: ${exists}`);
    console.log(`PASS: Wallet exists for 999999999999: ${notExists}`);

    // Test 4: Sign message
    console.log('\nTest 4: Signing message');
    const message = 'Hello from TokenVault!';
    const signResult = await app.signMessage(aadhaar1, message);
    console.log('PASS: Message signed successfully');
    console.log(`   Message: "${message}"`);
    console.log(`   Signature: ${signResult.signature.substring(0, 30)}...`);
    console.log(`   Message Hash: ${signResult.messageHash}`);
    console.log(`   Wallet Address: ${signResult.walletAddress}`);

    // Test 5: Verify signature
    console.log('\nTest 5: Verifying signature');
    const isValid = await app.verifySignature(
      signResult.walletAddress,
      message,
      signResult.signature
    );
    console.log(`PASS: Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);

    // Test 6: Invalid signature verification
    console.log('\nTest 6: Invalid signature verification');
    const isInvalid = await app.verifySignature(
      signResult.walletAddress,
      'Different message',
      signResult.signature
    );
    console.log(`PASS: Invalid signature verification: ${isInvalid ? 'VALID' : 'INVALID'}`);

    // Test 7: Multiple signatures
    console.log('\nTest 7: Multiple signatures');
    await app.signMessage(aadhaar1, 'Message 1');
    await app.signMessage(aadhaar1, 'Message 2');
    await app.signMessage(aadhaar1, 'Message 3');
    
    const history = await app.getSignatureHistory(aadhaar1);
    console.log(`PASS: Signature history: ${history.length} signatures`);
    console.log('   Recent signatures:');
    history.slice(0, 3).forEach((sig, index) => {
      console.log(`     ${index + 1}. ${sig.signature.substring(0, 20)}... at ${new Date(sig.timestamp).toLocaleString()}`);
    });

    // Test 8: Different Aadhaar numbers
    console.log('\nTest 8: Different Aadhaar numbers');
    const aadhaar2 = '987654321098';
    const wallet2 = await app.processAadhaarNumber(aadhaar2);
    console.log('PASS: Second wallet created');
    console.log(`   Different addresses: ${wallet1.walletAddress !== wallet2.walletAddress}`);
    console.log(`   Wallet 1: ${wallet1.walletAddress}`);
    console.log(`   Wallet 2: ${wallet2.walletAddress}`);

    // Test 9: Invalid Aadhaar number format
    console.log('\nTest 9: Invalid Aadhaar number format');
    try {
      await app.processAadhaarNumber('12345'); // Too short
      console.log('FAIL: Should have thrown error for invalid format');
    } catch (error) {
      console.log('PASS: Correctly rejected invalid Aadhaar format');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 10: Get all wallets
    console.log('\nTest 10: Getting all wallets');
    const allWallets = await app.getAllWallets();
    console.log(`PASS: Retrieved ${allWallets.length} wallets`);
    allWallets.forEach((wallet, index) => {
      console.log(`   ${index + 1}. Aadhaar: ${wallet.aadhaarNumber}, Address: ${wallet.walletAddress}`);
    });

    // Test 11: Deterministic wallet generation
    console.log('\nTest 11: Deterministic wallet generation');
    const tempApp = new TokenVaultApp('./temp_test.db');
    const wallet3 = await tempApp.processAadhaarNumber(aadhaar1);
    console.log('PASS: Deterministic generation verified');
    console.log(`   Same address: ${wallet1.walletAddress === wallet3.walletAddress}`);
    console.log(`   Same private key: ${wallet1.privateKey === wallet3.privateKey}`);
    tempApp.close();

    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('FAIL: Test failed:', error);
  } finally {
    app.close();
    
    // Clean up test databases
    const fs = require('fs');
    try {
      fs.unlinkSync('./test_vault.db');
      fs.unlinkSync('./temp_test.db');
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export default runTests;
