require('dotenv').config();
const express = require('express');
const path = require('path');
const RelayerService = require('./src/relayer-service');
const chalk = require('chalk');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

let relayerService;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize relayer service
async function initService() {
  if (!relayerService) {
    relayerService = new RelayerService();
    await relayerService.initialize();
  }
  return relayerService;
}

// Dashboard HTML
const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QOBI Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px);
            border-radius: 15px; 
            padding: 20px; 
            text-align: center;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-value { font-size: 2.5em; font-weight: bold; color: #ffd700; margin-bottom: 10px; }
        .stat-label { font-size: 1.1em; opacity: 0.9; }
        .section { 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px);
            border-radius: 15px; 
            padding: 25px; 
            margin-bottom: 25px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .section h2 { margin-bottom: 20px; color: #ffd700; }
        .batch-item { 
            background: rgba(255,255,255,0.05); 
            border-radius: 10px; 
            padding: 15px; 
            margin-bottom: 15px;
            border-left: 4px solid #ffd700;
        }
        .batch-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .batch-id { font-weight: bold; color: #ffd700; }
        .batch-time { opacity: 0.7; font-size: 0.9em; }
        .batch-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
        .batch-stat { text-align: center; }
        .batch-stat-value { font-weight: bold; color: #4ade80; }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px;
        }
        .status-running { background-color: #4ade80; }
        .status-error { background-color: #ef4444; }
        .ai-status { display: flex; align-items: center; margin-bottom: 15px; }
        .merkle-root { 
            font-family: monospace; 
            background: rgba(0,0,0,0.3); 
            padding: 8px; 
            border-radius: 5px; 
            word-break: break-all;
            font-size: 0.9em;
        }
        .refresh-btn {
            background: linear-gradient(45deg, #ffd700, #ffed4e);
            color: #333;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        .refresh-btn:hover { transform: scale(1.05); }
        .loading { opacity: 0.6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 QOBI Dashboard</h1>
            <p>Quantum Oracle Blockchain Intelligence - Real-time Monitoring</p>
            <button class="refresh-btn" onclick="refreshData()">🔄 Refresh Data</button>
        </div>

        <div class="stats-grid" id="statsGrid">
            <!-- Stats will be populated by JavaScript -->
        </div>

        <div class="section">
            <h2>🤖 AI Validator Status</h2>
            <div id="aiStatus">
                <!-- AI status will be populated by JavaScript -->
            </div>
        </div>

        <div class="section">
            <h2>📦 Recent Batches</h2>
            <div id="recentBatches">
                <!-- Batches will be populated by JavaScript -->
            </div>
        </div>

        <div class="section">
            <h2>🌳 Merkle Tree Information</h2>
            <div id="merkleInfo">
                <!-- Merkle info will be populated by JavaScript -->
            </div>
        </div>
    </div>

    <script>
        async function fetchData() {
            try {
                const response = await fetch('/api/dashboard-data');
                return await response.json();
            } catch (error) {
                console.error('Error fetching data:', error);
                return null;
            }
        }

        function renderStats(stats) {
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = \`
                <div class="stat-card">
                    <div class="stat-value">\${stats.pendingTransactions}</div>
                    <div class="stat-label">Pending Transactions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${stats.totalProcessed}</div>
                    <div class="stat-label">Total Processed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${stats.totalValidated}</div>
                    <div class="stat-label">Total Validated</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${stats.totalRelayed}</div>
                    <div class="stat-label">Total Relayed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${stats.processedBatches}</div>
                    <div class="stat-label">Processed Batches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">\${stats.averageProcessingTime.toFixed(0)}ms</div>
                    <div class="stat-label">Avg Processing Time</div>
                </div>
            \`;
        }

        function renderAIStatus(aiData) {
            const aiStatus = document.getElementById('aiStatus');
            const connected = aiData.connection && aiData.connection.connected;
            
            aiStatus.innerHTML = \`
                <div class="ai-status">
                    <span class="status-indicator \${connected ? 'status-running' : 'status-error'}"></span>
                    <strong>Connection:</strong> \${connected ? 'Connected' : 'Disconnected'}
                </div>
                <div><strong>Model:</strong> \${aiData.connection ? aiData.connection.currentModel : 'Unknown'}</div>
                \${aiData.stats && aiData.stats.totalValidations ? \`
                    <div><strong>Total Validations:</strong> \${aiData.stats.totalValidations}</div>
                    <div><strong>Average Risk Score:</strong> \${aiData.stats.averageRiskScore.toFixed(2)}%</div>
                    <div><strong>Average Confidence:</strong> \${aiData.stats.averageConfidence.toFixed(2)}%</div>
                \` : '<div><em>No validations performed yet</em></div>'}
            \`;
        }

        function renderBatches(batches) {
            const container = document.getElementById('recentBatches');
            
            if (!batches || batches.length === 0) {
                container.innerHTML = '<p><em>No batches processed yet</em></p>';
                return;
            }

            container.innerHTML = batches.map(batch => \`
                <div class="batch-item">
                    <div class="batch-header">
                        <span class="batch-id">📦 \${batch.id}</span>
                        <span class="batch-time">\${new Date(batch.processedAt).toLocaleString()}</span>
                    </div>
                    <div class="batch-stats">
                        <div class="batch-stat">
                            <div class="batch-stat-value">\${batch.stats.total}</div>
                            <div>Total</div>
                        </div>
                        <div class="batch-stat">
                            <div class="batch-stat-value">\${batch.stats.validated}</div>
                            <div>Validated</div>
                        </div>
                        <div class="batch-stat">
                            <div class="batch-stat-value">\${batch.stats.rejected}</div>
                            <div>Rejected</div>
                        </div>
                        <div class="batch-stat">
                            <div class="batch-stat-value">\${batch.processingTime}ms</div>
                            <div>Processing Time</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        <strong>Merkle Root:</strong>
                        <div class="merkle-root">\${batch.merkleRoot}</div>
                    </div>
                </div>
            \`).join('');
        }

        function renderMerkleInfo(merkleStats) {
            const container = document.getElementById('merkleInfo');
            
            if (!merkleStats) {
                container.innerHTML = '<p><em>No merkle tree data available</em></p>';
                return;
            }

            container.innerHTML = \`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <strong>Total Leaves:</strong> \${merkleStats.leafCount}
                    </div>
                    <div>
                        <strong>Tree Depth:</strong> \${merkleStats.depth}
                    </div>
                    <div>
                        <strong>Layer Count:</strong> \${merkleStats.layerCount}
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <strong>Current Root:</strong>
                    <div class="merkle-root">\${merkleStats.root}</div>
                </div>
            \`;
        }

        async function refreshData() {
            const container = document.querySelector('.container');
            container.classList.add('loading');
            
            const data = await fetchData();
            
            if (data) {
                renderStats(data.stats);
                renderAIStatus(data.aiData);
                renderBatches(data.batches);
                renderMerkleInfo(data.stats.merkleTreeStats);
            }
            
            container.classList.remove('loading');
        }

        // Initial load
        refreshData();

        // Auto-refresh every 30 seconds
        setInterval(refreshData, 30000);
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
  res.send(dashboardHTML);
});

app.get('/api/dashboard-data', async (req, res) => {
  try {
    const service = await initService();
    
    const stats = service.getStats();
    const batches = service.getRecentBatches(10);
    
    // Get AI status
    let aiData = { connection: { connected: false }, stats: {} };
    try {
      const connection = await service.aiValidator.testConnection();
      const aiStats = service.aiValidator.getValidationStats();
      aiData = { connection, stats: aiStats };
    } catch (error) {
      console.log('AI data fetch error:', error.message);
    }

    res.json({
      stats,
      batches,
      aiData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startDashboard() {
  try {
    console.log(chalk.blue('🚀 Initializing QOBI Dashboard...'));
    
    app.listen(PORT, () => {
      console.log(chalk.green(`✅ QOBI Dashboard running on http://localhost:${PORT}`));
      console.log(chalk.blue('📊 Real-time monitoring interface available'));
      console.log(chalk.yellow('🔄 Auto-refresh every 30 seconds'));
    });
  } catch (error) {
    console.error(chalk.red('❌ Failed to start dashboard:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  startDashboard();
}

module.exports = app;
