import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { TokenVaultApp } from './index';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize TokenVault
const vault = new TokenVaultApp('./production_vault.db');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple route handlers
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TokenVault server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Create/Get wallet
app.post('/api/wallet', async (req: Request, res: Response) => {
  try {
    const { aadhaarNumber } = req.body;
    
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    const wallet = await vault.processAadhaarNumber(aadhaarNumber);
    
    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Sign message
app.post('/api/wallet/sign', async (req: Request, res: Response) => {
  try {
    const { aadhaarNumber, message } = req.body;
    
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const signature = await vault.signMessage(aadhaarNumber, message);
    
    res.json({
      success: true,
      data: signature,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Verify signature
app.post('/api/wallet/verify', async (req: Request, res: Response) => {
  try {
    const { walletAddress, message, signature } = req.body;
    
    if (!walletAddress || !message || !signature) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, message, and signature are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const isValid = await vault.verifySignature(walletAddress, message, signature);
    
    res.json({
      success: true,
      data: { isValid },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get all wallets
app.get('/api/admin/wallets', async (req: Request, res: Response) => {
  try {
    const wallets = await vault.getAllWallets();
    
    res.json({
      success: true,
      data: wallets,
      count: wallets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Check wallet existence (simple route)
app.get('/api/wallet/exists', async (req: Request, res: Response) => {
  try {
    const { aadhaar } = req.query;
    
    if (!aadhaar || !/^\d{12}$/.test(aadhaar as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    const exists = await vault.hasWallet(aadhaar as string);
    
    res.json({
      success: true,
      data: { exists },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get signature history
app.get('/api/wallet/signatures', async (req: Request, res: Response) => {
  try {
    const { aadhaar } = req.query;
    
    if (!aadhaar || !/^\d{12}$/.test(aadhaar as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    const signatures = await vault.getSignatureHistory(aadhaar as string);
    
    res.json({
      success: true,
      data: signatures,
      count: signatures.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Create/Get wallet with multi-factor identity
app.post('/api/wallet/identity', async (req: Request, res: Response) => {
  try {
    const { aadhaarNumber, email, phoneNumber, name } = req.body;
    
    // Validate all required fields
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number format. Must be 12 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Must be 10 digits.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name cannot be empty.',
        timestamp: new Date().toISOString()
      });
    }
    
    const userIdentity = {
      aadhaarNumber,
      email: email.toLowerCase(),
      phoneNumber,
      name: name.trim()
    };
    
    const wallet = await vault.processUserIdentity(userIdentity);
    
    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
TokenVault Server is running!
Server: http://localhost:${PORT}
Health: http://localhost:${PORT}/health
Started at: ${new Date().toISOString()}

Available endpoints:
  POST /api/wallet - Create/get wallet (legacy)
  POST /api/wallet/identity - Create/get wallet with full identity
  POST /api/wallet/sign - Sign message
  POST /api/wallet/verify - Verify signature
  GET /api/wallet/exists?aadhaar=... - Check wallet existence
  GET /api/wallet/signatures?aadhaar=... - Get signature history
  GET /api/admin/wallets - Get all wallets
  `);
});

export default app;
