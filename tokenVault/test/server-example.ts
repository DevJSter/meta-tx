import { TokenVaultApp } from '../src/index';

/**
 * Simple usage example of the TokenVault system
 * This demonstrates the basic server-like functionality
 */

async function serverExample() {
  console.log('=== TokenVault Server Example ===\n');
  
  const vault = new TokenVaultApp('./server_vault.db');

  // Simulate server API calls
  const exampleRequests = [
    { aadhaarNumber: '123456789012', action: 'get_or_create_wallet' },
    { aadhaarNumber: '987654321098', action: 'get_or_create_wallet' },
    { aadhaarNumber: '123456789012', action: 'check_existence' },
    { aadhaarNumber: '123456789012', action: 'sign_message', message: 'Hello World' },
    { aadhaarNumber: '999999999999', action: 'check_existence' },
  ];

  console.log('Processing server requests...\n');

  for (const request of exampleRequests) {
    try {
      console.log(`📥 Request: ${request.action} for Aadhaar ${request.aadhaarNumber}`);
      
      switch (request.action) {
        case 'get_or_create_wallet':
          const wallet = await vault.processAadhaarNumber(request.aadhaarNumber);
          console.log(`✅ Response: {`);
          console.log(`     aadhaarNumber: "${wallet.aadhaarNumber}",`);
          console.log(`     privateKey: "${wallet.privateKey}",`);
          console.log(`     publicKey: "${wallet.publicKey}",`);
          console.log(`     walletAddress: "${wallet.walletAddress}",`);
          console.log(`     signatureHash: "${wallet.signatureHash}",`);
          console.log(`     timestamp: ${wallet.timestamp}`);
          console.log(`   }`);
          break;
          
        case 'check_existence':
          const exists = await vault.hasWallet(request.aadhaarNumber);
          console.log(`✅ Response: { exists: ${exists} }`);
          break;
          
        case 'sign_message':
          if (request.message) {
            const signature = await vault.signMessage(request.aadhaarNumber, request.message);
            console.log(`✅ Response: {`);
            console.log(`     signature: "${signature.signature}",`);
            console.log(`     messageHash: "${signature.messageHash}",`);
            console.log(`     walletAddress: "${signature.walletAddress}",`);
            console.log(`     timestamp: ${signature.timestamp}`);
            console.log(`   }`);
          }
          break;
      }
      
      console.log('');
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Show final state
  console.log('=== Final Database State ===');
  const allWallets = await vault.getAllWallets();
  console.log(`Total wallets: ${allWallets.length}`);
  allWallets.forEach((wallet, index) => {
    console.log(`${index + 1}. Aadhaar: ${wallet.aadhaarNumber}`);
    console.log(`   Address: ${wallet.walletAddress}`);
    console.log(`   Created: ${new Date(wallet.timestamp).toLocaleString()}`);
  });

  vault.close();
  console.log('\n✅ Server example completed!');
}

// API-like functions for server integration
export class TokenVaultServer {
  private vault: TokenVaultApp;

  constructor(dbPath?: string) {
    this.vault = new TokenVaultApp(dbPath);
  }

  /**
   * API endpoint: POST /api/wallet
   * Body: { aadhaarNumber: string }
   */
  async createOrGetWallet(aadhaarNumber: string) {
    return await this.vault.processAadhaarNumber(aadhaarNumber);
  }

  /**
   * API endpoint: GET /api/wallet/exists/:aadhaarNumber
   */
  async checkWalletExists(aadhaarNumber: string) {
    return { exists: await this.vault.hasWallet(aadhaarNumber) };
  }

  /**
   * API endpoint: POST /api/wallet/sign
   * Body: { aadhaarNumber: string, message: string }
   */
  async signMessage(aadhaarNumber: string, message: string) {
    return await this.vault.signMessage(aadhaarNumber, message);
  }

  /**
   * API endpoint: GET /api/wallet/signatures/:aadhaarNumber
   */
  async getSignatureHistory(aadhaarNumber: string) {
    return await this.vault.getSignatureHistory(aadhaarNumber);
  }

  /**
   * API endpoint: GET /api/admin/wallets
   */
  async getAllWallets() {
    return await this.vault.getAllWallets();
  }

  close() {
    this.vault.close();
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  serverExample();
}

export default serverExample;
