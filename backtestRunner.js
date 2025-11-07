import { Backtester } from './backtester.js';
import { collectMarketSnapshot, fetchETHPrice } from './dataCollector.js';
import { updateThresholds } from './advancedMonitor.js';

/**
 * Run backtesting to find optimal thresholds
 * This should be run periodically to refine alert criteria
 */
export async function runBacktestingAnalysis(historicalDataPoints = []) {
  console.log('\n🔬 Starting Advanced Backtesting Analysis...\n');
  
  const backtester = new Backtester();
  
  // Add historical data points
  if (historicalDataPoints.length > 0) {
    console.log(`📊 Loading ${historicalDataPoints.length} historical data points...`);
    historicalDataPoints.forEach(dp => {
      backtester.addDataPoint(dp.snapshot, dp.futureETHPrice);
    });
  } else {
    console.log('⚠️  No historical data provided. Collecting sample data...');
    
    // Collect sample data (in production, this would use stored historical data)
    for (let i = 0; i < 5; i++) {
      try {
        const snapshot = await collectMarketSnapshot();
        
        // Simulate waiting for price movement (in production, use actual historical data)
        await new Promise(resolve => setTimeout(resolve, 2000));
        const futurePrice = await fetchETHPrice();
        
        backtester.addDataPoint(snapshot, futurePrice.price);
        console.log(`✅ Collected sample ${i + 1}/5`);
      } catch (error) {
        console.error(`❌ Error collecting sample ${i + 1}:`, error.message);
      }
    }
  }
  
  // Run analysis
  console.log('\n🔍 Running threshold optimization...\n');
  const report = backtester.generateReport();
  
  // Display results
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 BACKTESTING RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('🎯 Optimal Thresholds:');
  console.log(`   Price Weight: ${report.optimalThresholds.price}`);
  console.log(`   Volume Weight: ${report.optimalThresholds.volume}`);
  console.log(`   Open Interest Weight: ${report.optimalThresholds.openInterest}\n`);
  
  console.log('📈 Performance Metrics:');
  console.log(`   Success Rate: ${report.performance.successRate.toFixed(1)}%`);
  console.log(`   Precision: ${report.performance.precision.toFixed(3)}`);
  console.log(`   Total Alerts: ${report.performance.totalAlerts}`);
  console.log(`   Successful Predictions: ${report.performance.successful}`);
  console.log(`   False Positives: ${report.performance.falsePositives}\n`);
  
  console.log('📊 Data Analysis:');
  console.log(`   Historical Data Points: ${report.dataPoints}`);
  console.log(`   Recommendation: ${report.recommendation}\n`);
  
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Update monitoring thresholds if performance is good
  if (report.performance.successRate >= 30) {
    console.log('✅ Updating monitoring thresholds with optimized values...');
    updateThresholds({
      priceWeight: report.optimalThresholds.price,
      volumeWeight: report.optimalThresholds.volume,
      oiWeight: report.optimalThresholds.openInterest
    });
  } else {
    console.log('⚠️  Success rate too low. Keeping default thresholds.');
    console.log('   Collect more historical data for better optimization.');
  }
  
  return report;
}

/**
 * Start continuous data collection for future backtesting
 */
export async function startDataCollection(intervalMinutes = 10) {
  console.log(`📊 Starting continuous data collection (every ${intervalMinutes} minutes)...`);
  
  const dataStore = [];
  
  setInterval(async () => {
    try {
      const snapshot = await collectMarketSnapshot();
      const ethPrice = await fetchETHPrice();
      
      dataStore.push({
        snapshot,
        ethPrice: ethPrice.price,
        timestamp: Date.now()
      });
      
      console.log(`✅ Data point collected (${dataStore.length} total)`);
      
      // Keep last 1000 data points
      if (dataStore.length > 1000) {
        dataStore.shift();
      }
      
    } catch (error) {
      console.error('❌ Error collecting data:', error.message);
    }
  }, intervalMinutes * 60 * 1000);
  
  return dataStore;
}