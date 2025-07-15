import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

// API Client class
export class TokenVaultClient {
  private baseURL: string;

  constructor(baseURL: string = BASE_URL) {
    this.baseURL = baseURL;
  }

  // Create or get wallet
  async createWallet(aadhaarNumber: string) {
    try {
      const response = await axios.post(`${this.baseURL}/wallet`, {
        aadhaarNumber
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Check if wallet exists
  async checkWalletExists(aadhaarNumber: string) {
    try {
      const response = await axios.get(`${this.baseURL}/wallet/exists/${aadhaarNumber}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get wallet details
  async getWallet(aadhaarNumber: string) {
    try {
      const response = await axios.get(`${this.baseURL}/wallet/${aadhaarNumber}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Sign message
  async signMessage(aadhaarNumber: string, message: string) {
    try {
      const response = await axios.post(`${this.baseURL}/wallet/sign`, {
        aadhaarNumber,
        message
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get signature history
  async getSignatureHistory(aadhaarNumber: string) {
    try {
      const response = await axios.get(`${this.baseURL}/wallet/signatures/${aadhaarNumber}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Verify signature
  async verifySignature(walletAddress: string, message: string, signature: string) {
    try {
      const response = await axios.post(`${this.baseURL}/wallet/verify`, {
        walletAddress,
        message,
        signature
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Admin: Get all wallets
  async getAllWallets() {
    try {
      const response = await axios.get(`${this.baseURL}/admin/wallets`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL.replace('/api', '')}/health`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any) {
    if (error.response) {
      // Server responded with error
      return new Error(error.response.data.error || 'Server error');
    } else if (error.request) {
      // Network error
      return new Error('Network error - server not reachable');
    } else {
      // Other error
      return new Error(error.message || 'Unknown error');
    }
  }
}

// Example usage functions
export async function testAPIClient() {
  const client = new TokenVaultClient();
  
  console.log('🧪 Testing TokenVault API Client...\n');

  try {
    // Health check
    console.log('1. Health Check');
    const health = await client.healthCheck();
    console.log('✅ Server is healthy:', health.message);

    // Create wallet
    console.log('\n2. Create Wallet');
    const aadhaarNumber = '123456789012';
    const wallet = await client.createWallet(aadhaarNumber);
    console.log('✅ Wallet created/retrieved:', wallet.data.walletAddress);

    // Check existence
    console.log('\n3. Check Wallet Existence');
    const exists = await client.checkWalletExists(aadhaarNumber);
    console.log('✅ Wallet exists:', exists.data.exists);

    // Sign message
    console.log('\n4. Sign Message');
    const message = 'Hello from API client!';
    const signature = await client.signMessage(aadhaarNumber, message);
    console.log('✅ Message signed:', signature.data.signature.substring(0, 20) + '...');

    // Verify signature
    console.log('\n5. Verify Signature');
    const verification = await client.verifySignature(
      wallet.data.walletAddress,
      message,
      signature.data.signature
    );
    console.log('✅ Signature valid:', verification.data.isValid);

    // Get signature history
    console.log('\n6. Get Signature History');
    const history = await client.getSignatureHistory(aadhaarNumber);
    console.log('✅ Signature history:', history.count, 'signatures');

    // Get all wallets (admin)
    console.log('\n7. Get All Wallets (Admin)');
    const allWallets = await client.getAllWallets();
    console.log('✅ Total wallets:', allWallets.count);

    console.log('\n🎉 All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run tests if executed directly
if (require.main === module) {
  testAPIClient();
}
