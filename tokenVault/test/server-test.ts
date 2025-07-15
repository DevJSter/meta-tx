import { spawn, ChildProcess } from 'child_process';
import { TokenVaultClient } from './api-client';

// Test suite for server API
class ServerTestSuite {
  private client: TokenVaultClient;
  private serverProcess: ChildProcess | null = null;

  constructor() {
    this.client = new TokenVaultClient();
  }

  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Starting server...');
      this.serverProcess = spawn('ts-node', ['src/server.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('TokenVault Server is running')) {
          console.log('Server started successfully');
          setTimeout(resolve, 1000); // Give server time to fully start
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Server start timeout'));
      }, 10000);
    });
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      console.log('Server stopped');
    }
  }

  async runTests(): Promise<void> {
    console.log('Running comprehensive server tests...\n');

    const testCases = [
      { name: 'Health Check', fn: this.testHealthCheck.bind(this) },
      { name: 'Create Wallet', fn: this.testCreateWallet.bind(this) },
      { name: 'Check Wallet Existence', fn: this.testWalletExists.bind(this) },
      { name: 'Get Wallet Details', fn: this.testGetWallet.bind(this) },
      { name: 'Sign Message', fn: this.testSignMessage.bind(this) },
      { name: 'Verify Signature', fn: this.testVerifySignature.bind(this) },
      { name: 'Get Signature History', fn: this.testSignatureHistory.bind(this) },
      { name: 'Invalid Aadhaar Format', fn: this.testInvalidAadhaar.bind(this) },
      { name: 'Multiple Wallets', fn: this.testMultipleWallets.bind(this) },
      { name: 'Admin Functions', fn: this.testAdminFunctions.bind(this) }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
      try {
        console.log(`Testing: ${test.name}`);
        await test.fn();
        console.log(`PASS: ${test.name} - PASSED\n`);
        passed++;
      } catch (error) {
        console.log(`FAIL: ${test.name} - FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
        failed++;
      }
    }

    console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  }

  private async testHealthCheck(): Promise<void> {
    const result = await this.client.healthCheck();
    if (!result.success) {
      throw new Error('Health check failed');
    }
  }

  private async testCreateWallet(): Promise<void> {
    const result = await this.client.createWallet('123456789012');
    if (!result.success || !result.data.walletAddress) {
      throw new Error('Wallet creation failed');
    }
  }

  private async testWalletExists(): Promise<void> {
    const result = await this.client.checkWalletExists('123456789012');
    if (!result.success || !result.data.exists) {
      throw new Error('Wallet existence check failed');
    }
  }

  private async testGetWallet(): Promise<void> {
    const result = await this.client.getWallet('123456789012');
    if (!result.success || !result.data.walletAddress) {
      throw new Error('Get wallet failed');
    }
  }

  private async testSignMessage(): Promise<void> {
    const result = await this.client.signMessage('123456789012', 'Test message');
    if (!result.success || !result.data.signature) {
      throw new Error('Message signing failed');
    }
  }

  private async testVerifySignature(): Promise<void> {
    const wallet = await this.client.getWallet('123456789012');
    const signature = await this.client.signMessage('123456789012', 'Verify test');
    
    const result = await this.client.verifySignature(
      wallet.data.walletAddress,
      'Verify test',
      signature.data.signature
    );
    
    if (!result.success || !result.data.isValid) {
      throw new Error('Signature verification failed');
    }
  }

  private async testSignatureHistory(): Promise<void> {
    const result = await this.client.getSignatureHistory('123456789012');
    if (!result.success || result.count === undefined) {
      throw new Error('Signature history retrieval failed');
    }
  }

  private async testInvalidAadhaar(): Promise<void> {
    try {
      await this.client.createWallet('invalid');
      throw new Error('Should have rejected invalid Aadhaar');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid Aadhaar')) {
        // Expected error
        return;
      }
      throw error;
    }
  }

  private async testMultipleWallets(): Promise<void> {
    const wallet1 = await this.client.createWallet('111111111111');
    const wallet2 = await this.client.createWallet('222222222222');
    
    if (wallet1.data.walletAddress === wallet2.data.walletAddress) {
      throw new Error('Different Aadhaar numbers should create different wallets');
    }
  }

  private async testAdminFunctions(): Promise<void> {
    const result = await this.client.getAllWallets();
    if (!result.success || result.count === undefined) {
      throw new Error('Admin get all wallets failed');
    }
  }
}

// CURL examples for manual testing
export function generateCurlExamples(): void {
  console.log(`
CURL Examples for TokenVault API:

1. Health Check:
curl -X GET http://localhost:3000/health

2. Create/Get Wallet:
curl -X POST http://localhost:3000/api/wallet \\
  -H "Content-Type: application/json" \\
  -d '{"aadhaarNumber": "123456789012"}'

3. Check Wallet Exists:
curl -X GET http://localhost:3000/api/wallet/exists/123456789012

4. Sign Message:
curl -X POST http://localhost:3000/api/wallet/sign \\
  -H "Content-Type: application/json" \\
  -d '{"aadhaarNumber": "123456789012", "message": "Hello World"}'

5. Verify Signature:
curl -X POST http://localhost:3000/api/wallet/verify \\
  -H "Content-Type: application/json" \\
  -d '{"walletAddress": "0x...", "message": "Hello World", "signature": "0x..."}'

6. Get Signature History:
curl -X GET http://localhost:3000/api/wallet/signatures/123456789012

7. Get All Wallets (Admin):
curl -X GET http://localhost:3000/api/admin/wallets

8. API Documentation:
curl -X GET http://localhost:3000/api/docs
`);
}

// Main test function
async function runServerTests(): Promise<void> {
  const testSuite = new ServerTestSuite();
  
  try {
    await testSuite.startServer();
    
    // Wait a bit for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testSuite.runTests();
    
    console.log('\nCURL Examples:');
    generateCurlExamples();
    
  } catch (error) {
    console.error('FAIL: Test suite failed:', error instanceof Error ? error.message : String(error));
  } finally {
    await testSuite.stopServer();
  }
}

// Run tests if executed directly
if (require.main === module) {
  runServerTests();
}

export default runServerTests;
