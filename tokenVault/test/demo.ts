import { TokenVaultApp } from '../src/index';

async function demo() {
  console.log('TokenVault Demo - Aadhaar-based Wallet Management\n');
  
  const app = new TokenVaultApp('./demo_vault.db');

  try {
    // Demo 1: Create/Get wallet for Aadhaar number
    console.log('Demo 1: Processing Aadhaar number');
    const aadhaarNumber = '352621448481';
    
    const wallet = await app.processAadhaarNumber(aadhaarNumber);
    console.log(`SUCCESS: Wallet for Aadhaar ${aadhaarNumber}:`);
    console.log(`   Address: ${wallet.walletAddress}`);
    console.log(`   Private Key: ${wallet.privateKey}`);
    console.log(`   Public Key: ${wallet.publicKey}`);
    console.log(`   Signature Hash: ${wallet.signatureHash}`);
    console.log(`   Created: ${new Date(wallet.timestamp).toLocaleString()}`);

    // Demo 2: Check wallet existence
    console.log('\nDemo 2: Checking wallet existence');
    const exists = await app.hasWallet(aadhaarNumber);
    const notExists = await app.hasWallet('999999999999');
    console.log(`SUCCESS: Wallet exists for ${aadhaarNumber}: ${exists}`);
    console.log(`SUCCESS: Wallet exists for 999999999999: ${notExists}`);

    // Demo 3: Sign a message
    console.log('\nDemo 3: Signing messages');
    const message1 = 'Transaction: Transfer 100 tokens to 0x1234...';
    const message2 = 'Document: Contract signed on ' + new Date().toISOString();
    
    const signature1 = await app.signMessage(aadhaarNumber, message1);
    const signature2 = await app.signMessage(aadhaarNumber, message2);
    
    console.log(`SUCCESS: Signed message 1: "${message1}"`);
    console.log(`   Signature: ${signature1.signature}`);
    console.log(`SUCCESS: Signed message 2: "${message2}"`);
    console.log(`   Signature: ${signature2.signature}`);

    // Demo 4: Verify signatures
    console.log('\nDemo 4: Verifying signatures');
    const isValid1 = await app.verifySignature(wallet.walletAddress, message1, signature1.signature);
    const isValid2 = await app.verifySignature(wallet.walletAddress, message2, signature2.signature);
    const isInvalid = await app.verifySignature(wallet.walletAddress, 'Wrong message', signature1.signature);
    
    console.log(`SUCCESS: Signature 1 valid: ${isValid1}`);
    console.log(`SUCCESS: Signature 2 valid: ${isValid2}`);
    console.log(`SUCCESS: Wrong message signature valid: ${isInvalid}`);

    // Demo 5: Signature history
    console.log('\nDemo 5: Signature history');
    const history = await app.getSignatureHistory(aadhaarNumber);
    console.log(`SUCCESS: Total signatures: ${history.length}`);
    history.forEach((sig, index) => {
      console.log(`   ${index + 1}. ${sig.signature.substring(0, 20)}... at ${new Date(sig.timestamp).toLocaleString()}`);
    });

    // Demo 6: Multiple Aadhaar numbers
    console.log('\nDemo 6: Multiple Aadhaar numbers');
    const aadhaar2 = '987654321098';
    const aadhaar3 = '555666777888';
    
    const wallet2 = await app.processAadhaarNumber(aadhaar2);
    const wallet3 = await app.processAadhaarNumber(aadhaar3);
    
    console.log(`SUCCESS: Wallet 2 (${aadhaar2}): ${wallet2.walletAddress}`);
    console.log(`SUCCESS: Wallet 3 (${aadhaar3}): ${wallet3.walletAddress}`);

    // Demo 7: Get all wallets
    console.log('\nDemo 7: All wallets in system');
    const allWallets = await app.getAllWallets();
    console.log(`SUCCESS: Total wallets: ${allWallets.length}`);
    allWallets.forEach((wallet, index) => {
      console.log(`   ${index + 1}. Aadhaar: ${wallet.aadhaarNumber}, Address: ${wallet.walletAddress}`);
    });

    console.log('\nDemo completed successfully!');
    console.log('\nKey Features:');
    console.log('   • Deterministic wallet generation from Aadhaar numbers');
    console.log('   • Secure private key storage');
    console.log('   • Message signing and verification');
    console.log('   • Signature history tracking');
    console.log('   • TypeScript implementation with ethers.js');
    console.log('   • SQLite database for persistence');

  } catch (error) {
    console.error('FAIL: Demo failed:', error);
  } finally {
    app.close();
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demo();
}

export default demo;
