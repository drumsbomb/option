# ETH Options Monitor - Advanced Backend Service

24/7 monitoring with **ML-optimized detection** that predicts 2%+ ETH price movements before option expiry.

## 🚀 What's New in v2.0 (Advanced Mode)

### Advanced Features
- ✅ **ML-Optimized Thresholds**: Statistical analysis to find optimal detection criteria
- ✅ **Z-Score Anomaly Detection**: Identifies options that deviate significantly from the mean
- ✅ **Time-to-Expiry Weighting**: Prioritizes options closer to expiry (0.5-48h window)
- ✅ **Backtesting Framework**: Tests different thresholds against historical data
- ✅ **Continuous Learning**: Collects data for ongoing optimization
- ✅ **High-Probability Alerts**: Only alerts when predicting 2%+ ETH moves

### How It Works

1. **Statistical Analysis**: Calculates mean, standard deviation, and z-scores for price, volume, and open interest
2. **Anomaly Scoring**: Weights multiple factors (price, volume, OI, time decay) into a single anomaly score
3. **Smart Filtering**: Only alerts on options expiring within 0.5-48 hours
4. **Backtesting**: Tests different threshold combinations to find what actually predicts 2%+ ETH moves
5. **Adaptive Learning**: Continuously collects data to refine thresholds over time

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
RECIPIENT_EMAIL=your.email@example.com
CHECK_INTERVAL_MINUTES=5
ALERT_COOLDOWN_HOURS=6
```

### 3. Run Advanced Mode

```bash
npm start
```

The service will:
- Start advanced monitoring with ML-optimized thresholds
- Run initial backtesting after 30 seconds
- Collect data continuously for ongoing optimization
- Send high-probability alerts when anomalies detected

### 4. Run Basic Mode (Original)

If you prefer the simpler original version:
```bash
npm run start:basic
```

## API Endpoints

### Advanced Monitoring

All original endpoints plus:

#### Run Backtesting
```
POST /api/backtest
```
Runs backtesting analysis and updates thresholds based on results.

Response:
```json
{
  "success": true,
  "report": {
    "optimalThresholds": {
      "price": 1.5,
      "volume": 1.0,
      "openInterest": 0.5
    },
    "performance": {
      "successRate": 65.5,
      "precision": 0.655,
      "totalAlerts": 120,
      "successful": 78,
      "falsePositives": 42
    },
    "recommendation": "GOOD: Moderate success rate..."
  }
}
```

## Detection Criteria

### Anomaly Score Calculation

```
Anomaly Score = (Price Z-Score × 1.5) + 
                (Volume Z-Score × 1.0) + 
                (OI Z-Score × 0.5) + 
                (Time Decay Factor × 2.0)
```

**Alert triggered when:** Anomaly Score ≥ 5.0

### Z-Score Formula

```
Z-Score = (Value - Mean) / Standard Deviation
```

- **Price Z-Score**: How many standard deviations the option price is from the mean
- **Volume Z-Score**: How unusual the trading volume is
- **OI Z-Score**: How unusual the open interest is

### Time Decay Factor

```
Time Decay = (48 - Hours to Expiry) / 48
```

Options closer to expiry get higher weight (more predictive of immediate ETH moves).

### Time Window

Only monitors options expiring within **0.5 to 48 hours**.

## Email Alert Format

```
🚨 HIGH-PROBABILITY ETH OPTIONS ALERT
Expiry: 2025-11-08

📊 Current ETH Price: $3,245.50

⚡ 8 High-Probability Anomalies Detected
(ML-optimized criteria predicting 2%+ ETH move before expiry)

🎯 Top 5 Most Significant:
1. ETH-8NOV25-3300-C
   • Anomaly Score: 7.85 (threshold: 5.0)
   • Price Z-Score: 3.20σ | Volume Z-Score: 2.15σ
   • Time to Expiry: 12.5h
   • Current Price: 99.50 ETH
   • Volume: $1,250,000

...
```

## Backtesting

### Run Manual Backtest

```bash
npm run backtest
```

Or via API:
```bash
curl -X POST http://localhost:3001/api/backtest
```

### Backtesting Output

```
═══════════════════════════════════════════════════════
📊 BACKTESTING RESULTS
═══════════════════════════════════════════════════════

🎯 Optimal Thresholds:
   Price Weight: 1.5
   Volume Weight: 1.0
   Open Interest Weight: 0.5

📈 Performance Metrics:
   Success Rate: 65.5%
   Precision: 0.655
   Total Alerts: 120
   Successful Predictions: 78
   False Positives: 42

📊 Data Analysis:
   Historical Data Points: 200
   Recommendation: GOOD: Moderate success rate...
```

### Interpreting Results

- **Success Rate ≥ 70%**: Excellent - Deploy with confidence
- **Success Rate 50-70%**: Good - Moderate reliability
- **Success Rate 30-50%**: Fair - Consider more data
- **Success Rate < 30%**: Poor - Needs refinement

## Configuration

### Detection Thresholds

Edit `src/advancedMonitor.js`:

```javascript
let OPTIMAL_THRESHOLDS = {
  priceWeight: 1.5,        // Weight for price anomalies
  volumeWeight: 1.0,       // Weight for volume anomalies
  oiWeight: 0.5,           // Weight for open interest anomalies
  anomalyScoreThreshold: 5.0,  // Minimum score to trigger alert
  minTimeToExpiry: 0.5,    // Minimum hours to expiry
  maxTimeToExpiry: 48      // Maximum hours to expiry
};
```

### Data Collection Interval

Edit `src/serverAdvanced.js`:

```javascript
startDataCollection(10); // Collect every 10 minutes
```

## Deployment

Same as basic version - deploy to Render, Railway, or Fly.io.

The advanced mode uses the same deployment process but with enhanced detection logic.

### Render Deployment

1. Go to [render.com](https://render.com)
2. Create "Web Service"
3. Set start command: `npm start`
4. Add environment variables
5. Deploy!

## Architecture

```
src/
├── serverAdvanced.js      # Advanced server with ML features
├── advancedMonitor.js     # ML-optimized monitoring logic
├── backtester.js          # Backtesting framework
├── backtestRunner.js      # Backtest execution
├── dataCollector.js       # Historical data collection
├── emailService.js        # Email alerts
├── state.js               # State management
├── server.js              # Basic server (original)
└── monitor.js             # Basic monitoring (original)
```

## Performance Optimization

### Reduce False Positives

Increase anomaly score threshold:
```javascript
anomalyScoreThreshold: 6.0  // Higher = fewer but more confident alerts
```

### Focus on Shorter Timeframes

Reduce max time to expiry:
```javascript
maxTimeToExpiry: 24  // Only monitor options expiring within 24h
```

### Adjust Weights

Prioritize price over volume:
```javascript
priceWeight: 2.0,
volumeWeight: 0.5
```

## Troubleshooting

### Low Success Rate

1. Collect more historical data (run for 7-14 days)
2. Run backtesting: `npm run backtest`
3. Adjust thresholds based on results
4. Consider narrower time window (e.g., 0.5-24h)

### Too Many Alerts

1. Increase `anomalyScoreThreshold` to 6.0 or 7.0
2. Reduce `maxTimeToExpiry` to 24 hours
3. Increase alert cooldown to 12 hours

### Too Few Alerts

1. Decrease `anomalyScoreThreshold` to 4.0
2. Increase `maxTimeToExpiry` to 72 hours
3. Reduce alert cooldown to 3 hours

## Monitoring & Logs

### Check Advanced Status
```bash
curl http://localhost:3001/api/status
```

### View Alert History
```bash
curl http://localhost:3001/api/alerts
```

### Trigger Manual Check
```bash
curl -X POST http://localhost:3001/api/trigger-check
```

### Run Backtesting
```bash
curl -X POST http://localhost:3001/api/backtest
```

## Future Enhancements

- [ ] Store historical data in database
- [ ] Add more ML features (bid-ask spread, implied volatility)
- [ ] Implement neural network for pattern recognition
- [ ] Add support for multiple cryptocurrencies
- [ ] Real-time dashboard with charts
- [ ] Webhook notifications (Discord, Telegram, Slack)

## License

MIT

## Support

For issues or questions, check the logs or create an issue in the repository.