# 🔐 TokenVault Server - Aadhaar-based Wallet Management

A complete TypeScript server solution for managing Ethereum wallets based on Aadhaar numbers using ethers.js and Express.js.

## 🚀 Features

- **RESTful API** - Complete REST API for wallet management
- **Deterministic Wallets** - Generate consistent wallets from Aadhaar numbers
- **Signature Management** - Sign messages and verify signatures
- **Web Interface** - HTML test interface for easy API testing
- **TypeScript** - Full TypeScript implementation with type safety
- **Security** - Built-in security headers and CORS support
- **Database** - SQLite for persistent storage
- **Comprehensive Testing** - Unit tests and API tests

## 📋 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build and start production server
npm run build
npm start

# Run tests
npm test

# Run server tests
npm test:server
```

## 🌐 API Endpoints

### Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/docs` | API documentation |
| POST | `/api/wallet` | Create or get wallet |
| GET | `/api/wallet/exists/:aadhaarNumber` | Check wallet existence |
| GET | `/api/wallet/:aadhaarNumber` | Get wallet details |
| POST | `/api/wallet/sign` | Sign message |
| POST | `/api/wallet/verify` | Verify signature |
| GET | `/api/wallet/signatures/:aadhaarNumber` | Get signature history |
| GET | `/api/admin/wallets` | Get all wallets (admin) |

## 📝 API Usage Examples

### 1. Create/Get Wallet
```bash
curl -X POST http://localhost:3000/api/wallet \
  -H "Content-Type: application/json" \
  -d '{"aadhaarNumber": "123456789012"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "aadhaarNumber": "123456789012",
    "privateKey": "0x...",
    "publicKey": "0x...",
    "walletAddress": "0x...",
    "signatureHash": "0x...",
    "timestamp": 1642694400000
  },
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

### 2. Check Wallet Existence
```bash
curl -X GET http://localhost:3000/api/wallet/exists/123456789012
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exists": true
  },
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

### 3. Sign Message
```bash
curl -X POST http://localhost:3000/api/wallet/sign \
  -H "Content-Type: application/json" \
  -d '{"aadhaarNumber": "123456789012", "message": "Hello World"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "0x...",
    "messageHash": "0x...",
    "walletAddress": "0x...",
    "timestamp": 1642694400000
  },
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

### 4. Verify Signature
```bash
curl -X POST http://localhost:3000/api/wallet/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "message": "Hello World",
    "signature": "0x..."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true
  },
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

## 🖥️ Web Interface

Access the test interface at: `http://localhost:3000`

The web interface provides:
- Real-time server status
- Interactive forms for all API endpoints
- JSON response visualization
- Input validation
- Error handling

## 🏗️ Server Architecture

```
src/
├── server.ts          # Main Express server
├── TokenVault.ts      # Core wallet management logic
├── types.ts           # TypeScript interfaces
├── index.ts           # TokenVault app wrapper
└── demo.ts            # Demo script

test/
├── runner.ts          # Test runner
├── test.ts            # Unit tests
├── server-test.ts     # Server API tests
├── api-client.ts      # API client for testing
└── server-example.ts  # Server usage examples

public/
└── index.html         # Web test interface
```

## 🛠️ Development Commands

```bash
# Development
npm run dev           # Start development server with auto-reload
npm run build         # Build TypeScript to JavaScript
npm start            # Start production server
npm run clean        # Clean build directory

# Testing
npm test             # Run all tests
npm run test:unit    # Run unit tests only
npm run test:server  # Run server API tests only
npm run test:example # Run server example
npm run demo         # Run demo script

# Server
npm run server       # Start server directly
```

## 📊 Database Schema

### Wallets Table
```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aadhaar_number TEXT UNIQUE NOT NULL,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```

### Signatures Table
```sql
CREATE TABLE signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aadhaar_number TEXT NOT NULL,
  message TEXT NOT NULL,
  signature TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
```

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Input Validation** - Aadhaar number format validation
- **Error Handling** - Comprehensive error responses
- **Rate Limiting** - (Can be added with express-rate-limit)

## 📚 TypeScript Client

Use the built-in TypeScript client for programmatic access:

```typescript
import { TokenVaultClient } from './src/api-client';

const client = new TokenVaultClient();

// Create wallet
const wallet = await client.createWallet('123456789012');

// Sign message
const signature = await client.signMessage('123456789012', 'Hello');

// Verify signature
const isValid = await client.verifySignature(
  wallet.data.walletAddress,
  'Hello',
  signature.data.signature
);
```

## 🚨 Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-20T10:00:00.000Z"
}
```

Common error codes:
- `400` - Bad Request (invalid input)
- `404` - Not Found (wallet not found)
- `500` - Internal Server Error

## 🔧 Configuration

Environment variables:
```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment
DB_PATH=./production_vault.db # Database path
```

## 📈 Performance Considerations

- **Database Indexing** - Aadhaar numbers are indexed for fast lookups
- **Connection Pooling** - SQLite handles connections efficiently
- **Caching** - Consider adding Redis for production
- **Clustering** - Use PM2 or similar for production scaling

## 🛡️ Production Deployment

1. **Environment Setup**
```bash
npm run build
NODE_ENV=production npm start
```

2. **Security Enhancements**
- Use HTTPS in production
- Implement rate limiting
- Add authentication middleware
- Use environment variables for secrets
- Implement proper logging

3. **Database Security**
- Encrypt private keys before storage
- Use secure database connections
- Implement backup strategies
- Monitor database performance

## 🧪 Testing

Run comprehensive tests:
```bash
# Unit tests
npm test

# Server API tests
npm test:server

# Manual testing with web interface
npm run server
# Then open http://localhost:3000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This is a demonstration project. For production use:
- Implement proper authentication
- Encrypt sensitive data
- Use secure key management
- Comply with local regulations
- Implement proper audit logging

---

**Built with TypeScript, Express.js, and ethers.js** 
