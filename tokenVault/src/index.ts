import { TokenVault } from './TokenVault';
import { WalletResponse, SignatureResult, UserIdentity } from './types';

export { TokenVault, WalletResponse, SignatureResult, UserIdentity };

// Main application class
export class TokenVaultApp {
  private vault: TokenVault;

  constructor(dbPath?: string) {
    this.vault = new TokenVault(dbPath);
  }

  /**
   * Process Aadhaar number and return wallet data
   * If wallet exists, return existing data
   * If wallet doesn't exist, create new one
   */
  async processAadhaarNumber(aadhaarNumber: string): Promise<WalletResponse> {
    // Validate Aadhaar number format (12 digits)
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      throw new Error('Invalid Aadhaar number format. Must be 12 digits.');
    }

    // Check if wallet exists
    const existingWallet = await this.vault.getWalletByAadhaar(aadhaarNumber);
    
    if (existingWallet) {
      console.log(`Wallet found for Aadhaar: ${aadhaarNumber}`);
      return existingWallet;
    }

    // Create new wallet
    console.log(`Creating new wallet for Aadhaar: ${aadhaarNumber}`);
    // For backward compatibility, create a basic identity
    const userIdentity: UserIdentity = {
      aadhaarNumber,
      email: `user${aadhaarNumber}@example.com`,
      phoneNumber: '9999999999',
      name: 'Legacy User'
    };
    const newWallet = await this.vault.createWallet(userIdentity);
    return newWallet;
  }

  /**
   * Process user identity (Aadhaar + email + phone + name) and return wallet data
   * If wallet exists, return existing data
   * If wallet doesn't exist, create new one using combined identity
   */
  async processUserIdentity(userIdentity: UserIdentity): Promise<WalletResponse> {
    // Validate Aadhaar number format (12 digits)
    if (!/^\d{12}$/.test(userIdentity.aadhaarNumber)) {
      throw new Error('Invalid Aadhaar number format. Must be 12 digits.');
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userIdentity.email)) {
      throw new Error('Invalid email format.');
    }

    // Validate phone number format (10 digits)
    if (!/^\d{10}$/.test(userIdentity.phoneNumber)) {
      throw new Error('Invalid phone number format. Must be 10 digits.');
    }

    // Validate name (non-empty)
    if (!userIdentity.name || userIdentity.name.trim().length === 0) {
      throw new Error('Name cannot be empty.');
    }

    // Check if wallet exists with this exact identity combination
    const existingWallet = await this.vault.getWalletByIdentity(userIdentity);
    
    if (existingWallet) {
      console.log(`Wallet found for user: ${userIdentity.name} (${userIdentity.aadhaarNumber})`);
      return existingWallet;
    }

    // Create new wallet using combined identity
    console.log(`Creating new wallet for user: ${userIdentity.name} (${userIdentity.aadhaarNumber})`);
    console.log(`Email: ${userIdentity.email}, Phone: ${userIdentity.phoneNumber}`);
    return await this.vault.createWallet(userIdentity);
  }

  /**
   * Sign a message with the wallet associated with Aadhaar number
   */
  async signMessage(aadhaarNumber: string, message: string): Promise<SignatureResult> {
    return await this.vault.signMessage(aadhaarNumber, message);
  }

  /**
   * Verify a signature
   */
  async verifySignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
    return await this.vault.verifySignature(walletAddress, message, signature);
  }

  /**
   * Get signature history for an Aadhaar number
   */
  async getSignatureHistory(aadhaarNumber: string): Promise<SignatureResult[]> {
    return await this.vault.getSignatureHistory(aadhaarNumber);
  }

  /**
   * Check if wallet exists for Aadhaar number
   */
  async hasWallet(aadhaarNumber: string): Promise<boolean> {
    return await this.vault.hasWallet(aadhaarNumber);
  }

  /**
   * Get all wallets (admin function)
   */
  async getAllWallets(): Promise<WalletResponse[]> {
    return await this.vault.getAllWallets();
  }

  /**
   * Close the vault connection
   */
  close(): void {
    this.vault.close();
  }
}

// Default export for easy usage
export default TokenVaultApp;
