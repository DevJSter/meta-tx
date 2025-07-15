const crypto = require('crypto');
const Wallet = require('ethereumjs-wallet').default;
const { Web3 } = require('web3');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class TokenVault {
    constructor(dbPath = './vault.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.web3 = new Web3();
        this.initializeDatabase();
    }

    // Initialize SQLite database
    initializeDatabase() {
        this.db = new sqlite3.Database(this.dbPath);
        
        // Create tables if they don't exist
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS wallets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    aadhaar_hash TEXT UNIQUE NOT NULL,
                    wallet_address TEXT NOT NULL,
                    private_key_encrypted TEXT NOT NULL,
                    public_key TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            this.db.run(`
                CREATE TABLE IF NOT EXISTS signatures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT NOT NULL,
                    message_hash TEXT NOT NULL,
                    signature TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES wallets (wallet_address)
                )
            `);
        });
    }

    // Hash Aadhaar number for privacy
    hashAadhaar(aadhaarNumber) {
        return crypto.createHash('sha256').update(aadhaarNumber.toString()).digest('hex');
    }

    // Generate deterministic private key from Aadhaar
    generatePrivateKeyFromAadhaar(aadhaarNumber) {
        const seed = crypto.createHash('sha256').update(aadhaarNumber.toString()).digest();
        return '0x' + seed.toString('hex');
    }

    // Encrypt private key
    encryptPrivateKey(privateKey, password) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    // Decrypt private key
    decryptPrivateKey(encryptedData, password) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        
        if (encryptedData.authTag) {
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        }
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    // Create wallet from Aadhaar number
    async createWalletFromAadhaar(aadhaarNumber, password) {
        return new Promise((resolve, reject) => {
            try {
                const aadhaarHash = this.hashAadhaar(aadhaarNumber);
                
                // Check if wallet already exists
                this.db.get(
                    "SELECT * FROM wallets WHERE aadhaar_hash = ?",
                    [aadhaarHash],
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        if (row) {
                            reject(new Error('Wallet already exists for this Aadhaar number'));
                            return;
                        }
                        
                        // Generate wallet
                        const privateKey = this.generatePrivateKeyFromAadhaar(aadhaarNumber);
                        const wallet = Wallet.fromPrivateKey(Buffer.from(privateKey.slice(2), 'hex'));
                        
                        const walletAddress = wallet.getAddressString();
                        const publicKey = wallet.getPublicKeyString();
                        
                        // Encrypt private key
                        const encryptedPrivateKey = this.encryptPrivateKey(privateKey, password);
                        
                        // Store in database
                        this.db.run(
                            `INSERT INTO wallets (aadhaar_hash, wallet_address, private_key_encrypted, public_key) 
                             VALUES (?, ?, ?, ?)`,
                            [aadhaarHash, walletAddress, JSON.stringify(encryptedPrivateKey), publicKey],
                            function(err) {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                resolve({
                                    walletAddress: walletAddress,
                                    publicKey: publicKey,
                                    aadhaarHash: aadhaarHash
                                });
                            }
                        );
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    // Get wallet by Aadhaar number
    async getWalletByAadhaar(aadhaarNumber) {
        return new Promise((resolve, reject) => {
            const aadhaarHash = this.hashAadhaar(aadhaarNumber);
            
            this.db.get(
                "SELECT * FROM wallets WHERE aadhaar_hash = ?",
                [aadhaarHash],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (!row) {
                        reject(new Error('Wallet not found for this Aadhaar number'));
                        return;
                    }
                    
                    resolve({
                        walletAddress: row.wallet_address,
                        publicKey: row.public_key,
                        aadhaarHash: row.aadhaar_hash,
                        createdAt: row.created_at
                    });
                }
            );
        });
    }

    // Sign message with wallet
    async signMessage(aadhaarNumber, message, password) {
        return new Promise((resolve, reject) => {
            try {
                const aadhaarHash = this.hashAadhaar(aadhaarNumber);
                
                this.db.get(
                    "SELECT * FROM wallets WHERE aadhaar_hash = ?",
                    [aadhaarHash],
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        if (!row) {
                            reject(new Error('Wallet not found for this Aadhaar number'));
                            return;
                        }
                        
                        try {
                            // Decrypt private key
                            const encryptedData = JSON.parse(row.private_key_encrypted);
                            const privateKey = this.decryptPrivateKey(encryptedData, password);
                            
                            // Create wallet instance
                            const wallet = Wallet.fromPrivateKey(Buffer.from(privateKey.slice(2), 'hex'));
                            
                            // Sign message
                            const messageHash = this.web3.utils.keccak256(message);
                            const signature = wallet.sign(Buffer.from(messageHash.slice(2), 'hex'));
                            
                            const signatureString = '0x' + signature.r.toString('hex') + signature.s.toString('hex') + signature.v.toString(16);
                            
                            // Store signature in database
                            this.db.run(
                                `INSERT INTO signatures (wallet_address, message_hash, signature) 
                                 VALUES (?, ?, ?)`,
                                [row.wallet_address, messageHash, signatureString],
                                function(err) {
                                    if (err) {
                                        console.warn('Could not store signature:', err);
                                    }
                                }
                            );
                            
                            resolve({
                                signature: signatureString,
                                messageHash: messageHash,
                                walletAddress: row.wallet_address
                            });
                            
                        } catch (decryptError) {
                            reject(new Error('Invalid password or corrupted data'));
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    }

    // Verify signature
    async verifySignature(walletAddress, message, signature) {
        try {
            const messageHash = this.web3.utils.keccak256(message);
            const recoveredAddress = this.web3.eth.accounts.recover(messageHash, signature);
            
            return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            return false;
        }
    }

    // Get all signatures for a wallet
    async getSignatureHistory(aadhaarNumber) {
        return new Promise((resolve, reject) => {
            const aadhaarHash = this.hashAadhaar(aadhaarNumber);
            
            this.db.get(
                "SELECT wallet_address FROM wallets WHERE aadhaar_hash = ?",
                [aadhaarHash],
                (err, walletRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (!walletRow) {
                        reject(new Error('Wallet not found for this Aadhaar number'));
                        return;
                    }
                    
                    this.db.all(
                        "SELECT * FROM signatures WHERE wallet_address = ? ORDER BY created_at DESC",
                        [walletRow.wallet_address],
                        (err, rows) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            resolve(rows);
                        }
                    );
                }
            );
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = TokenVault;
