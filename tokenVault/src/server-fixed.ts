import express, { Request, Response, NextFunction } from 'express';
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
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(express.json()); // JSON parsing
app.use(express.urlencoded({ extended: true })); // URL encoding

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Custom error handler
interface CustomError extends Error {
  status?: number;
}

const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  console.error('Error:', err);
  
  res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
};

// Middleware to validate Aadhaar number
const validateAadhaar = (req: Request, res: Response, next: NextFunction) => {
  const aadhaarNumber = req.body.aadhaarNumber || req.params.aadhaarNumber;
  
  if (!aadhaarNumber) {
    return res.status(400).json({
      success: false,
      error: 'Aadhaar number is required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!/^\d{12}$/.test(aadhaarNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Aadhaar number format. Must be 12 digits.',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Routes

// Root endpoint - serve test interface
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TokenVault server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Documentation endpoint
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TokenVault API Documentation',
    endpoints: {
      'POST /api/wallet': 'Create or get wallet by Aadhaar number',
      'GET /api/wallet/exists/{aadhaarNumber}': 'Check if wallet exists',
      'GET /api/wallet/{aadhaarNumber}': 'Get wallet details',
      'POST /api/wallet/sign': 'Sign message with wallet',
      'GET /api/wallet/signatures/{aadhaarNumber}': 'Get signature history',
      'POST /api/wallet/verify': 'Verify signature',
      'GET /api/admin/wallets': 'Get all wallets (admin)',
      'DELETE /api/admin/wallet/{aadhaarNumber}': 'Delete wallet (admin)'
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/wallet - Create or get wallet by Aadhaar number
app.post('/api/wallet', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.body;
    
    const wallet = await vault.processAadhaarNumber(aadhaarNumber);
    
    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/wallet/sign - Sign message with wallet (must come before parametrized routes)
app.post('/api/wallet/sign', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber, message } = req.body;
    
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
    next(error);
  }
});

// POST /api/wallet/verify - Verify signature
app.post('/api/wallet/verify', async (req: Request, res: Response, next: NextFunction) => {
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
    next(error);
  }
});

// GET /api/wallet/exists/:aadhaarNumber - Check if wallet exists
app.get('/api/wallet/exists/:aadhaarNumber', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.params;
    
    const exists = await vault.hasWallet(aadhaarNumber);
    
    res.json({
      success: true,
      data: { exists },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/wallet/signatures/:aadhaarNumber - Get signature history
app.get('/api/wallet/signatures/:aadhaarNumber', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.params;
    
    const signatures = await vault.getSignatureHistory(aadhaarNumber);
    
    res.json({
      success: true,
      data: signatures,
      count: signatures.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/wallet/:aadhaarNumber - Get wallet details (must come after specific routes)
app.get('/api/wallet/:aadhaarNumber', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.params;
    
    const wallet = await vault.processAadhaarNumber(aadhaarNumber);
    
    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
app.get('/api/admin/wallets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallets = await vault.getAllWallets();
    
    res.json({
      success: true,
      data: wallets,
      count: wallets.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/wallet/:aadhaarNumber - Delete wallet (admin)
app.delete('/api/admin/wallet/:aadhaarNumber', validateAadhaar, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.params;
    
    const exists = await vault.hasWallet(aadhaarNumber);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Wallet deletion requested (not implemented)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler for undefined routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  vault.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  vault.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 TokenVault Server is running!
📍 Server: http://localhost:${PORT}
📖 Health: http://localhost:${PORT}/health
📚 API Docs: http://localhost:${PORT}/api/docs
🕐 Started at: ${new Date().toISOString()}
  `);
});

export default app;
