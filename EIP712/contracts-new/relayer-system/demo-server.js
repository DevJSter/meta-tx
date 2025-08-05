const express = require('express');
const { RelayerService } = require('./src/relayer-service');
const { AIValidator } = require('./src/ai-validator');
const path = require('path');
require('dotenv').config();

/**
 * Demo API server for QOBI relayer system
 */
class DemoServer {
    constructor() {
        this.app = express();
        this.relayerService = new RelayerService();
        this.aiValidator = new AIValidator();
        this.port = process.env.PORT || 3001;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Home page
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>QOBI Relayer System</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                        .card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .endpoint { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
                        .success { color: #28a745; }
                        .error { color: #dc3545; }
                        .info { color: #17a2b8; }
                        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
                        button:hover { background: #0056b3; }
                        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
                        .status { display: flex; gap: 10px; flex-wrap: wrap; }
                        .status-item { padding: 10px; border-radius: 5px; flex: 1; min-width: 200px; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🚀 QOBI Social Mining Relayer System</h1>
                        <p>AI-powered validation and automated Merkle tree submission</p>
                    </div>

                    <div class="grid">
                        <div class="card">
                            <h3>🤖 AI Validator</h3>
                            <p>Uses Ollama to validate social interactions and calculate QOBI rewards</p>
                            <button onclick="testAI()">Test AI Connection</button>
                            <button onclick="simulateValidation()">Simulate Validation</button>
                            <div id="aiResult"></div>
                        </div>

                        <div class="card">
                            <h3>⛓️ Relayer Service</h3>
                            <p>Processes and submits daily Merkle trees to blockchain</p>
                            <button onclick="getStatus()">Get Status</button>
                            <button onclick="processTrees()">Process Daily Trees</button>
                            <div id="relayerResult"></div>
                        </div>

                        <div class="card">
                            <h3>📊 System Overview</h3>
                            <p>Real-time status of the QOBI ecosystem</p>
                            <button onclick="getOverview()">Refresh Overview</button>
                            <div id="overviewResult"></div>
                        </div>
                    </div>

                    <div class="card">
                        <h3>🔧 API Endpoints</h3>
                        <div class="endpoint">
                            <strong>GET /api/status</strong> - Get relayer system status
                        </div>
                        <div class="endpoint">
                            <strong>POST /api/process</strong> - Trigger daily tree processing
                        </div>
                        <div class="endpoint">
                            <strong>GET /api/ai/test</strong> - Test AI validator connection
                        </div>
                        <div class="endpoint">
                            <strong>POST /api/ai/validate</strong> - Validate interactions
                        </div>
                        <div class="endpoint">
                            <strong>GET /api/trees/:day</strong> - Get trees for specific day
                        </div>
                    </div>

                    <script>
                        async function apiCall(url, method = 'GET', body = null) {
                            try {
                                const options = { method };
                                if (body) {
                                    options.headers = { 'Content-Type': 'application/json' };
                                    options.body = JSON.stringify(body);
                                }
                                const response = await fetch(url, options);
                                const data = await response.json();
                                return { success: response.ok, data };
                            } catch (error) {
                                return { success: false, error: error.message };
                            }
                        }

                        function displayResult(elementId, result) {
                            const element = document.getElementById(elementId);
                            if (result.success) {
                                element.innerHTML = '<pre class="success">' + JSON.stringify(result.data, null, 2) + '</pre>';
                            } else {
                                element.innerHTML = '<pre class="error">Error: ' + (result.error || 'Unknown error') + '</pre>';
                            }
                        }

                        async function testAI() {
                            const result = await apiCall('/api/ai/test');
                            displayResult('aiResult', result);
                        }

                        async function simulateValidation() {
                            const result = await apiCall('/api/ai/validate', 'POST', { 
                                interactionType: 0, 
                                count: 10 
                            });
                            displayResult('aiResult', result);
                        }

                        async function getStatus() {
                            const result = await apiCall('/api/status');
                            displayResult('relayerResult', result);
                        }

                        async function processTrees() {
                            document.getElementById('relayerResult').innerHTML = '<div class="info">Processing... This may take a few minutes.</div>';
                            const result = await apiCall('/api/process', 'POST');
                            displayResult('relayerResult', result);
                        }

                        async function getOverview() {
                            const result = await apiCall('/api/overview');
                            displayResult('overviewResult', result);
                        }

                        // Auto-refresh status every 30 seconds
                        setInterval(getStatus, 30000);
                        
                        // Load initial status
                        getStatus();
                        getOverview();
                    </script>
                </body>
                </html>
            `);
        });

        // API Routes
        this.app.get('/api/status', async (req, res) => {
            try {
                const status = await this.relayerService.getStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/process', async (req, res) => {
            try {
                const results = await this.relayerService.processDailyTrees();
                res.json({ 
                    success: true, 
                    message: 'Daily trees processed',
                    results 
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        this.app.get('/api/ai/test', async (req, res) => {
            try {
                const connected = await this.aiValidator.testConnection();
                res.json({ 
                    connected,
                    model: this.aiValidator.model,
                    url: this.aiValidator.ollamaUrl
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/ai/validate', async (req, res) => {
            try {
                const { interactionType = 0, count = 10 } = req.body;
                
                // Generate mock interactions for demo
                const mockInteractions = [];
                for (let i = 0; i < count; i++) {
                    mockInteractions.push({
                        user: `0x${Math.random().toString(16).substr(2, 40)}`,
                        content: `Mock interaction ${i + 1}`,
                        metadata: { engagement: Math.floor(Math.random() * 100) }
                    });
                }

                const validated = await this.aiValidator.validateInteractions(mockInteractions, interactionType);
                res.json({
                    success: true,
                    interactionType: this.aiValidator.interactionTypes[interactionType],
                    inputCount: mockInteractions.length,
                    validatedCount: validated.length,
                    validated
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/trees/:day', async (req, res) => {
            try {
                const day = parseInt(req.params.day);
                const trees = [];
                
                for (let interactionType = 0; interactionType < 6; interactionType++) {
                    const tree = await this.relayerService.contracts.dailyTree.getDailyTree(day, interactionType);
                    trees.push({
                        interactionType,
                        typeName: this.aiValidator.interactionTypes[interactionType],
                        merkleRoot: tree[0],
                        users: tree[1],
                        amounts: tree[2].map(amount => amount.toString()),
                        isSubmitted: tree[3]
                    });
                }

                res.json({ day, trees });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/overview', async (req, res) => {
            try {
                const status = await this.relayerService.getStatus();
                const aiConnected = await this.aiValidator.testConnection();
                
                // Calculate totals
                const totalUsers = status.trees?.reduce((sum, tree) => sum + tree.userCount, 0) || 0;
                const submittedTrees = status.trees?.filter(tree => tree.submitted).length || 0;
                
                res.json({
                    systemHealth: {
                        relayerAuthorized: status.hasPermission,
                        aiValidator: aiConnected,
                        blockchain: true // If we got status, blockchain is connected
                    },
                    dailyStats: {
                        currentDay: status.currentDay,
                        totalUsers,
                        submittedTrees,
                        totalTrees: 6
                    },
                    interactionTypes: this.aiValidator.interactionTypes,
                    contractAddresses: {
                        systemDeployer: process.env.SYSTEM_DEPLOYER_ADDRESS,
                        dailyTree: process.env.DAILY_TREE_ADDRESS,
                        merkleDistributor: process.env.MERKLE_DISTRIBUTOR_ADDRESS,
                        accessControl: process.env.ACCESS_CONTROL_ADDRESS
                    }
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async start() {
        // Initialize relayer service
        console.log('🔄 Initializing relayer service...');
        
        try {
            // Test connections
            await this.aiValidator.testConnection();
            await this.relayerService.checkPermissions();
            
            console.log('✅ All systems initialized');
        } catch (error) {
            console.warn('⚠️  Some services may not be available:', error.message);
        }

        // Start server
        this.app.listen(this.port, () => {
            console.log(`\n🌐 QOBI Demo Server running at:`);
            console.log(`   http://localhost:${this.port}`);
            console.log(`\n📡 API Endpoints:`);
            console.log(`   GET  /api/status - System status`);
            console.log(`   POST /api/process - Process daily trees`);
            console.log(`   GET  /api/ai/test - Test AI validator`);
            console.log(`\n💡 Make sure to start Ollama: ollama serve`);
        });
    }
}

// Start the demo server
if (require.main === module) {
    const demo = new DemoServer();
    demo.start().catch(console.error);
}

module.exports = { DemoServer };
