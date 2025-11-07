import fetch from 'node-fetch';
import { parseExpiryTimestamp } from './dataCollector.js';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2';

/**
 * Historical analysis to answer:
 * 1. How many alerts would have been sent last month?
 * 2. What percentage would be profitable?
 */

/**
 * Fetch historical ETH price at specific timestamp
 */
async function fetchHistoricalETHPrice(timestamp) {
  try {
    // Use trades endpoint to get price near timestamp
    const response = await fetch(
      `${DERIBIT_API_URL}/public/get_last_trades_by_instrument?instrument_name=ETH-PERPETUAL&count=1&end_timestamp=${timestamp}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const trades = data.result.trades || [];
    
    if (trades.length > 0) {
      return trades[0].price;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching historical price:', error);
    return null;
  }
}

/**
 * Fetch options data at a specific historical timestamp
 */
async function fetchHistoricalOptionsSnapshot(timestamp) {
  try {
    // Note: Deribit doesn't provide historical options book data via public API
    // We'll use current data as a proxy and note this limitation
    const response = await fetch(
      `${DERIBIT_API_URL}/public/get_book_summary_by_currency?currency=ETH&kind=option`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching options:', error);
    return [];
  }
}

/**
 * Calculate statistics for options
 */
function calculateStats(options, currentTime) {
  const expiryGroups = {};
  
  options.forEach(opt => {
    const expiryTimestamp = parseExpiryTimestamp(opt.instrument_name);
    if (!expiryTimestamp) return;
    
    const timeToExpiry = (expiryTimestamp - currentTime) / (1000 * 60 * 60);
    
    // Only 0.5-48h window
    if (timeToExpiry < 0.5 || timeToExpiry > 48) return;
    
    const expiryKey = new Date(expiryTimestamp).toISOString().split('T')[0];
    
    if (!expiryGroups[expiryKey]) {
      expiryGroups[expiryKey] = [];
    }
    
    expiryGroups[expiryKey].push({
      ...opt,
      timeToExpiry,
      expiryTimestamp
    });
  });
  
  const expiryStats = {};
  
  Object.entries(expiryGroups).forEach(([expiry, opts]) => {
    const validPrices = opts.filter(o => o.mark_price > 0).map(o => o.mark_price);
    const validVolumes = opts.filter(o => o.volume_usd > 0).map(o => o.volume_usd);
    const validOI = opts.filter(o => o.open_interest > 0).map(o => o.open_interest);
    
    if (validPrices.length > 0) {
      const avgPrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
      const avgVolume = validVolumes.length > 0 ? validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length : 0;
      const avgOI = validOI.length > 0 ? validOI.reduce((a, b) => a + b, 0) / validOI.length : 0;
      
      expiryStats[expiry] = {
        avgPrice,
        avgVolume,
        avgOI,
        stdPrice: calculateStdDev(validPrices, avgPrice),
        stdVolume: validVolumes.length > 0 ? calculateStdDev(validVolumes, avgVolume) : 0,
        stdOI: validOI.length > 0 ? calculateStdDev(validOI, avgOI) : 0,
        count: opts.length
      };
    }
  });
  
  return { expiryGroups, expiryStats };
}

function calculateStdDev(values, mean) {
  if (values.length === 0) return 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Detect alerts using ML criteria
 */
function detectAlerts(expiryGroups, expiryStats) {
  const alerts = [];
  
  Object.entries(expiryGroups).forEach(([expiry, opts]) => {
    const stats = expiryStats[expiry];
    if (!stats) return;
    
    opts.forEach(opt => {
      if (opt.mark_price <= 0) return;
      
      const priceZScore = stats.stdPrice > 0 ? 
        Math.abs((opt.mark_price - stats.avgPrice) / stats.stdPrice) : 0;
      
      const volumeZScore = stats.stdVolume > 0 && opt.volume_usd > 0 ? 
        Math.abs((opt.volume_usd - stats.avgVolume) / stats.stdVolume) : 0;
      
      const oiZScore = stats.stdOI > 0 && opt.open_interest > 0 ? 
        Math.abs((opt.open_interest - stats.avgOI) / stats.stdOI) : 0;
      
      const timeDecayFactor = (48 - opt.timeToExpiry) / 48;
      
      const anomalyScore = 
        (priceZScore * 1.5) +
        (volumeZScore * 1.0) +
        (oiZScore * 0.5) +
        (timeDecayFactor * 2.0);
      
      if (anomalyScore >= 5.0) {
        // Determine direction based on call/put
        const isCall = opt.instrument_name.endsWith('-C');
        const isPut = opt.instrument_name.endsWith('-P');
        
        // High price call = bullish, high price put = bearish
        const direction = isCall ? 'UP' : (isPut ? 'DOWN' : 'UNKNOWN');
        
        alerts.push({
          symbol: opt.instrument_name,
          expiryDate: expiry,
          expiryTimestamp: opt.expiryTimestamp,
          currentPrice: opt.mark_price,
          volume: opt.volume_usd,
          timeToExpiry: opt.timeToExpiry,
          anomalyScore,
          priceZScore,
          volumeZScore,
          direction,
          isCall,
          isPut
        });
      }
    });
  });
  
  return alerts.sort((a, b) => b.anomalyScore - a.anomalyScore);
}

/**
 * Run historical analysis for last month
 */
export async function runHistoricalAnalysis() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 HISTORICAL ANALYSIS - LAST MONTH');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('⚠️  IMPORTANT LIMITATION:');
  console.log('Deribit public API does not provide historical options book data.');
  console.log('This analysis uses CURRENT options data as a simulation.');
  console.log('For accurate historical analysis, you would need:');
  console.log('1. Historical options data from a paid data provider');
  console.log('2. Or collect data prospectively over the next 30 days\n');
  
  console.log('📊 Running simulation with current market data...\n');
  
  try {
    // Fetch current data
    const currentTime = Date.now();
    const options = await fetchHistoricalOptionsSnapshot(currentTime);
    const currentETHPrice = await fetchHistoricalETHPrice(currentTime);
    
    console.log(`✅ Fetched ${options.length} options`);
    console.log(`💰 Current ETH Price: $${currentETHPrice}\n`);
    
    // Calculate stats and detect alerts
    const { expiryGroups, expiryStats } = calculateStats(options, currentTime);
    const alerts = detectAlerts(expiryGroups, expiryStats);
    
    console.log(`🔍 Found ${alerts.length} alerts that meet ML criteria\n`);
    
    // Group by expiry (for cooldown simulation)
    const alertsByExpiry = {};
    alerts.forEach(alert => {
      if (!alertsByExpiry[alert.expiryDate]) {
        alertsByExpiry[alert.expiryDate] = [];
      }
      alertsByExpiry[alert.expiryDate].push(alert);
    });
    
    // Simulate cooldown (1 alert per expiry per 6 hours)
    const emailsSent = Object.keys(alertsByExpiry).length;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📧 EMAIL VOLUME ESTIMATE (Last 30 Days)');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Estimate for 30 days (assuming similar patterns)
    const checksPerDay = (24 * 60) / 5; // Every 5 minutes
    const daysInMonth = 30;
    const estimatedAlertsPerCheck = alerts.length;
    const estimatedEmailsPerCheck = emailsSent;
    
    // With 6-hour cooldown, max 4 emails per expiry per day
    const maxEmailsPerDay = Object.keys(alertsByExpiry).length * 4;
    const estimatedEmailsPerMonth = maxEmailsPerDay * daysInMonth;
    
    console.log(`📊 Current Snapshot Analysis:`);
    console.log(`   • Total anomalies detected: ${alerts.length}`);
    console.log(`   • Unique expiry dates: ${Object.keys(alertsByExpiry).length}`);
    console.log(`   • Emails that would be sent: ${emailsSent}\n`);
    
    console.log(`📈 Monthly Estimate (30 days):`);
    console.log(`   • Checks per day: ${checksPerDay.toFixed(0)}`);
    console.log(`   • Max emails per day: ${maxEmailsPerDay}`);
    console.log(`   • Estimated emails per month: ${estimatedEmailsPerMonth}\n`);
    
    console.log('⚠️  Note: Actual volume depends on market volatility\n');
    
    // Analyze alert directions
    const callAlerts = alerts.filter(a => a.isCall);
    const putAlerts = alerts.filter(a => a.isPut);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ALERT DIRECTION ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`📈 Bullish Signals (High-priced Calls): ${callAlerts.length}`);
    console.log(`📉 Bearish Signals (High-priced Puts): ${putAlerts.length}\n`);
    
    // Show top alerts by direction
    console.log('🎯 Top 5 Bullish Signals (Calls):');
    callAlerts.slice(0, 5).forEach((a, i) => {
      console.log(`${i + 1}. ${a.symbol}`);
      console.log(`   Anomaly Score: ${a.anomalyScore.toFixed(2)}, Time to Expiry: ${a.timeToExpiry.toFixed(1)}h`);
    });
    
    console.log('\n🎯 Top 5 Bearish Signals (Puts):');
    putAlerts.slice(0, 5).forEach((a, i) => {
      console.log(`${i + 1}. ${a.symbol}`);
      console.log(`   Anomaly Score: ${a.anomalyScore.toFixed(2)}, Time to Expiry: ${a.timeToExpiry.toFixed(1)}h`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💰 PROFITABILITY ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('⚠️  CANNOT CALCULATE ACTUAL PROFITABILITY:');
    console.log('Reason: No historical ETH price data available for comparison\n');
    
    console.log('📊 To calculate profitability, we need:');
    console.log('1. Historical options data from last month');
    console.log('2. ETH price at alert time');
    console.log('3. ETH price at expiry (or after 2% move)');
    console.log('4. Direction of movement (up/down)\n');
    
    console.log('💡 RECOMMENDATION:');
    console.log('Deploy the system and collect data for 30 days, then run:');
    console.log('   npm run backtest\n');
    console.log('This will give you ACTUAL profitability metrics based on');
    console.log('real alerts and real ETH price movements.\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`✅ Estimated emails per month: ${estimatedEmailsPerMonth}`);
    console.log(`📊 Alert distribution: ${callAlerts.length} bullish, ${putAlerts.length} bearish`);
    console.log(`⚠️  Profitability: Cannot calculate without historical data`);
    console.log(`💡 Next step: Deploy and collect 30 days of real data\n`);
    
    return {
      estimatedEmailsPerMonth,
      currentAlerts: alerts.length,
      bullishSignals: callAlerts.length,
      bearishSignals: putAlerts.length,
      uniqueExpiries: Object.keys(alertsByExpiry).length
    };
    
  } catch (error) {
    console.error('❌ Error in historical analysis:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHistoricalAnalysis()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}