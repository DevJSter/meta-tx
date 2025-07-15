import { ethers } from 'ethers';
import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { WalletData, WalletResponse, SignatureResult, UserIdentity } from './types';

export class TokenVault {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: any[]) => Promise<void>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;
  private initialized: boolean = false;

  constructor(dbPath: string = './token_vault.db') {
    this.db = new sqlite3.Database(dbPath);
    
    // Promisify database methods
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeDatabase();
      this.initialized = true;
    }
  }

  private async initializeDatabase(): Promise<void> {
    const createWalletsTable = `
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aadhaar_number TEXT NOT NULL,
        email TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        name TEXT NOT NULL,
        private_key TEXT NOT NULL,
        public_key TEXT NOT NULL,
        wallet_address TEXT UNIQUE NOT NULL,
        signature_hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE(aadhaar_number, email, phone_number, name)
      )
    `;

    const createSignaturesTable = `
      CREATE TABLE IF NOT EXISTS signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aadhaar_number TEXT NOT NULL,
        message TEXT NOT NULL,
        signature TEXT NOT NULL,
        message_hash TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (aadhaar_number) REFERENCES wallets (aadhaar_number)
      )
    `;

    await this.dbRun(createWalletsTable);
    await this.dbRun(createSignaturesTable);
  }

  /**
   * Create a new wallet from user identity (Aadhaar, email, phone, name)
   */
  async createWallet(userIdentity: UserIdentity): Promise<WalletResponse> {
    await this.ensureInitialized();
    
    // Check if wallet already exists with this exact identity combination
    const existingWallet = await this.getWalletByIdentity(userIdentity);
    if (existingWallet) {
      return existingWallet;
    }

    // Generate deterministic wallet from combined identity factors
    const identityString = `${userIdentity.aadhaarNumber}:${userIdentity.email}:${userIdentity.phoneNumber}:${userIdentity.name}`;
    const seed = ethers.id(identityString); // Creates deterministic hash from all identity factors
    const wallet = new ethers.Wallet(seed);
    
    // Create signature hash for transaction signing capability
    const standardMessage = `${userIdentity.aadhaarNumber}:${wallet.address}:transaction_capability`;
    const signatureHash = await wallet.signMessage(standardMessage);
    
    const walletData: WalletData = {
      aadhaarNumber: userIdentity.aadhaarNumber,
      email: userIdentity.email,
      phoneNumber: userIdentity.phoneNumber,
      name: userIdentity.name,
      privateKey: wallet.privateKey,
      publicKey: wallet.signingKey.publicKey,
      walletAddress: wallet.address,
      signatureHash,
      timestamp: Date.now()
    };

    // Store in database
    await this.dbRun(
      `INSERT INTO wallets (aadhaar_number, email, phone_number, name, private_key, public_key, wallet_address, signature_hash, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        walletData.aadhaarNumber,
        walletData.email,
        walletData.phoneNumber,
        walletData.name,
        walletData.privateKey,
        walletData.publicKey,
        walletData.walletAddress,
        walletData.signatureHash,
        walletData.timestamp
      ]
    );

    return walletData;
  }

  /**
   * Get wallet by complete identity (Aadhaar + email + phone + name)
   */
  async getWalletByIdentity(userIdentity: UserIdentity): Promise<WalletResponse | null> {
    await this.ensureInitialized();
    
    const result = await this.dbGet(
      'SELECT * FROM wallets WHERE aadhaar_number = ? AND email = ? AND phone_number = ? AND name = ?',
      [userIdentity.aadhaarNumber, userIdentity.email, userIdentity.phoneNumber, userIdentity.name]
    );

    if (!result) {
      return null;
    }

    return {
      aadhaarNumber: result.aadhaar_number,
      email: result.email,
      phoneNumber: result.phone_number,
      name: result.name,
      privateKey: result.private_key,
      publicKey: result.public_key,
      walletAddress: result.wallet_address,
      signatureHash: result.signature_hash,
      timestamp: result.timestamp
    };
  }

  /**
   * Get wallet by Aadhaar number
   */
  async getWalletByAadhaar(aadhaarNumber: string): Promise<WalletResponse | null> {
    await this.ensureInitialized();
    
    const result = await this.dbGet(
      'SELECT * FROM wallets WHERE aadhaar_number = ?',
      [aadhaarNumber]
    );

    if (!result) {
      return null;
    }

    return {
      aadhaarNumber: result.aadhaar_number,
      email: result.email,
      phoneNumber: result.phone_number,
      name: result.name,
      privateKey: result.private_key,
      publicKey: result.public_key,
      walletAddress: result.wallet_address,
      signatureHash: result.signature_hash,
      timestamp: result.timestamp
    };
  }

  /**
   * Check if wallet exists for given Aadhaar number
   */
  async hasWallet(aadhaarNumber: string): Promise<boolean> {
    await this.ensureInitialized();
    const wallet = await this.getWalletByAadhaar(aadhaarNumber);
    return wallet !== null;
  }

  /**
   * Sign a message using the wallet associated with Aadhaar number
   */
  async signMessage(aadhaarNumber: string, message: string): Promise<SignatureResult> {
    await this.ensureInitialized();
    
    const walletData = await this.getWalletByAadhaar(aadhaarNumber);
    if (!walletData) {
      throw new Error('Wallet not found for this Aadhaar number');
    }

    const wallet = new ethers.Wallet(walletData.privateKey);
    const signature = await wallet.signMessage(message);
    const messageHash = ethers.id(message);

    const signatureResult: SignatureResult = {
      signature,
      messageHash,
      walletAddress: walletData.walletAddress,
      timestamp: Date.now()
    };

    // Store signature in database
    await this.dbRun(
      `INSERT INTO signatures (aadhaar_number, message, signature, message_hash, wallet_address, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        aadhaarNumber,
        message,
        signature,
        messageHash,
        walletData.walletAddress,
        signatureResult.timestamp
      ]
    );

    return signatureResult;
  }

  /**
   * Verify a signature
   */
  async verifySignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get signature history for an Aadhaar number
   */
  async getSignatureHistory(aadhaarNumber: string): Promise<SignatureResult[]> {
    await this.ensureInitialized();
    
    const results = await this.dbAll(
      'SELECT * FROM signatures WHERE aadhaar_number = ? ORDER BY timestamp DESC',
      [aadhaarNumber]
    );

    return results.map(row => ({
      signature: row.signature,
      messageHash: row.message_hash,
      walletAddress: row.wallet_address,
      timestamp: row.timestamp
    }));
  }

  /**
   * Get all wallets (for admin purposes)
   */
  async getAllWallets(): Promise<WalletResponse[]> {
    await this.ensureInitialized();
    
    const results = await this.dbAll('SELECT * FROM wallets ORDER BY timestamp DESC');
    
    return results.map(row => ({
      aadhaarNumber: row.aadhaar_number,
      email: row.email,
      phoneNumber: row.phone_number,
      name: row.name,
      privateKey: row.private_key,
      publicKey: row.public_key,
      walletAddress: row.wallet_address,
      signatureHash: row.signature_hash,
      timestamp: row.timestamp
    }));
  }

  /**
   * Delete a wallet (for admin purposes)
   */
  async deleteWallet(aadhaarNumber: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const result = await this.dbRun(
      'DELETE FROM wallets WHERE aadhaar_number = ?',
      [aadhaarNumber]
    );
    
    // Also delete associated signatures
    await this.dbRun(
      'DELETE FROM signatures WHERE aadhaar_number = ?',
      [aadhaarNumber]
    );

    return true;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
