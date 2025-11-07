import { parseExpiryTimestamp, getTimeToExpiry } from './dataCollector.js';

/**
 * Advanced backtesting system for options alert criteria
 */
export class Backtester {
  constructor() {
    this.historicalData = [];
    this.results = {
      totalAlerts: 0,
      successfulPredictions: 0,
      falsePositives: 0,
      thresholdAnalysis: []
    };
  }

  /**
   * Add historical data point
   */
  addDataPoint(snapshot, futureETHPrice) {
    this.historicalData.push({
      ...snapshot,
      futureETHPrice
    });
  }

  /**
   * Calculate statistics for each expiry group
   */
  calculateExpiryStats(options) {
    const expiryGroups = {};
    
    options.forEach(opt => {
      const expiryTimestamp = parseExpiryTimestamp(opt.instrument);
      if (!expiryTimestamp) return;
      
      const expiryKey = new Date(expiryTimestamp).toISOString().split('T')[0];
      
      if (!expiryGroups[expiryKey]) {
        expiryGroups[expiryKey] = [];
      }
      expiryGroups[expiryKey].push(opt);
    });
    
    const expiryStats = {};
    
    Object.entries(expiryGroups).forEach(([expiry, opts]) => {
      const validPrices = opts.filter(o => o.markPrice > 0).map(o => o.markPrice);
      const validVolumes = opts.filter(o => o.volume > 0).map(o => o.volume);
      const validOI = opts.filter(o => o.openInterest > 0).map(o => o.openInterest);
      
      if (validPrices.length > 0) {
        expiryStats[expiry] = {
          avgPrice: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
          avgVolume: validVolumes.length > 0 ? validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length : 0,
          avgOI: validOI.length > 0 ? validOI.reduce((a, b) => a + b, 0) / validOI.length : 0,
          stdPrice: this.calculateStdDev(validPrices),
          stdVolume: validVolumes.length > 0 ? this.calculateStdDev(validVolumes) : 0,
          count: opts.length
        };
      }
    });
    
    return expiryStats;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Test different threshold combinations
   */
  testThresholds(priceThresholds, volumeThresholds, oiThresholds) {
    const results = [];
    
    for (const priceT of priceThresholds) {
      for (const volumeT of volumeThresholds) {
        for (const oiT of oiThresholds) {
          const result = this.runBacktest(priceT, volumeT, oiT);
          results.push({
            priceThreshold: priceT,
            volumeThreshold: volumeT,
            oiThreshold: oiT,
            ...result
          });
        }
      }
    }
    
    return results.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Run backtest with specific thresholds
   */
  runBacktest(priceThreshold, volumeThreshold, oiThreshold) {
    let totalAlerts = 0;
    let successful = 0;
    let falsePositives = 0;
    
    this.historicalData.forEach(dataPoint => {
      const { options, ethPrice, futureETHPrice, timestamp } = dataPoint;
      
      if (!futureETHPrice) return;
      
      const expiryStats = this.calculateExpiryStats(options);
      const alerts = this.detectAnomalies(options, expiryStats, priceThreshold, volumeThreshold, oiThreshold);
      
      if (alerts.length > 0) {
        totalAlerts++;
        
        // Check if ETH moved 2%+ in the predicted direction
        const priceChange = ((futureETHPrice - ethPrice) / ethPrice) * 100;
        const significantMove = Math.abs(priceChange) >= 2.0;
        
        if (significantMove) {
          successful++;
        } else {
          falsePositives++;
        }
      }
    });
    
    return {
      totalAlerts,
      successful,
      falsePositives,
      successRate: totalAlerts > 0 ? (successful / totalAlerts) * 100 : 0,
      precision: totalAlerts > 0 ? (successful / totalAlerts) : 0
    };
  }

  /**
   * Detect anomalies with configurable thresholds
   */
  detectAnomalies(options, expiryStats, priceThreshold, volumeThreshold, oiThreshold) {
    const alerts = [];
    
    options.forEach(opt => {
      const expiryTimestamp = parseExpiryTimestamp(opt.instrument);
      if (!expiryTimestamp) return;
      
      const expiryKey = new Date(expiryTimestamp).toISOString().split('T')[0];
      const stats = expiryStats[expiryKey];
      
      if (!stats || opt.markPrice <= 0) return;
      
      // Calculate z-scores (standard deviations from mean)
      const priceZScore = (opt.markPrice - stats.avgPrice) / (stats.stdPrice || 1);
      const volumeZScore = stats.avgVolume > 0 ? (opt.volume - stats.avgVolume) / (stats.stdVolume || 1) : 0;
      const oiZScore = stats.avgOI > 0 ? (opt.openInterest - stats.avgOI) / 1 : 0;
      
      // Time decay factor (closer to expiry = more significant)
      const timeToExpiry = opt.timeToExpiry || 0;
      const timeDecayFactor = timeToExpiry <= 48 ? (48 - timeToExpiry) / 48 : 0;
      
      // Weighted anomaly score
      const anomalyScore = 
        (Math.abs(priceZScore) * priceThreshold) +
        (Math.abs(volumeZScore) * volumeThreshold) +
        (Math.abs(oiZScore) * oiThreshold) +
        (timeDecayFactor * 2); // Time decay bonus
      
      // Alert if anomaly score exceeds threshold
      if (anomalyScore >= 5.0) {
        alerts.push({
          instrument: opt.instrument,
          anomalyScore,
          priceZScore,
          volumeZScore,
          oiZScore,
          timeToExpiry,
          timeDecayFactor
        });
      }
    });
    
    return alerts.sort((a, b) => b.anomalyScore - a.anomalyScore);
  }

  /**
   * Find optimal thresholds using grid search
   */
  findOptimalThresholds() {
    console.log('🔍 Running grid search for optimal thresholds...');
    
    const priceThresholds = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    const volumeThresholds = [0.5, 1.0, 1.5, 2.0, 2.5];
    const oiThresholds = [0.3, 0.5, 0.7, 1.0];
    
    const results = this.testThresholds(priceThresholds, volumeThresholds, oiThresholds);
    
    console.log('\n📊 Top 10 Threshold Combinations:');
    results.slice(0, 10).forEach((r, i) => {
      console.log(`${i + 1}. Price: ${r.priceThreshold}, Volume: ${r.volumeThreshold}, OI: ${r.oiThreshold}`);
      console.log(`   Success Rate: ${r.successRate.toFixed(1)}%, Precision: ${r.precision.toFixed(3)}`);
      console.log(`   Alerts: ${r.totalAlerts}, Successful: ${r.successful}, False: ${r.falsePositives}\n`);
    });
    
    return results[0]; // Return best performing combination
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const optimal = this.findOptimalThresholds();
    
    return {
      optimalThresholds: {
        price: optimal.priceThreshold,
        volume: optimal.volumeThreshold,
        openInterest: optimal.oiThreshold
      },
      performance: {
        successRate: optimal.successRate,
        precision: optimal.precision,
        totalAlerts: optimal.totalAlerts,
        successful: optimal.successful,
        falsePositives: optimal.falsePositives
      },
      dataPoints: this.historicalData.length,
      recommendation: this.generateRecommendation(optimal)
    };
  }

  /**
   * Generate recommendation based on results
   */
  generateRecommendation(optimal) {
    if (optimal.successRate >= 70) {
      return 'EXCELLENT: High success rate. Deploy with confidence.';
    } else if (optimal.successRate >= 50) {
      return 'GOOD: Moderate success rate. Consider collecting more data.';
    } else if (optimal.successRate >= 30) {
      return 'FAIR: Low success rate. Refine criteria or collect more data.';
    } else {
      return 'POOR: Very low success rate. Criteria need significant refinement.';
    }
  }
}