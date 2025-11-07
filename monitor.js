import fetch from 'node-fetch';
import { sendAlertEmail } from './emailService.js';
import { updateMonitorStatus, shouldSendAlert, recordAlertSent } from './state.js';

const DERIBIT_API_URL = process.env.DERIBIT_API_URL || 'https://www.deribit.com/api/v2';

// Fetch all ETH options data from Deribit
async function fetchOptionsData() {
  try {
    const response = await fetch(`${DERIBIT_API_URL}/public/get_book_summary_by_currency?currency=ETH&kind=option`);
    
    if (!response.ok) {
      throw new Error(`Deribit API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('❌ Error fetching options data:', error.message);
    throw error;
  }
}

// Parse expiry date from instrument name (e.g., "ETH-7NOV25-3300-C" -> "7NOV25")
function parseExpiryDate(instrumentName) {
  const parts = instrumentName.split('-');
  return parts.length >= 2 ? parts[1] : 'UNKNOWN';
}

// Calculate statistics for each expiry group
function calculateExpiryStats(options) {
  const expiryGroups = {};
  
  // Group by expiry date
  options.forEach(opt => {
    const expiry = parseExpiryDate(opt.instrument_name);
    if (!expiryGroups[expiry]) {
      expiryGroups[expiry] = [];
    }
    expiryGroups[expiry].push(opt);
  });
  
  // Calculate averages for each expiry
  const expiryStats = {};
  
  Object.entries(expiryGroups).forEach(([expiry, opts]) => {
    const validPrices = opts.filter(o => o.mark_price > 0).map(o => o.mark_price);
    const validVolumes = opts.filter(o => o.volume_usd > 0).map(o => o.volume_usd);
    
    if (validPrices.length > 0 && validVolumes.length > 0) {
      expiryStats[expiry] = {
        avgPrice: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
        avgVolume: validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length,
        count: opts.length
      };
    }
  });
  
  return { expiryGroups, expiryStats };
}

// Detect irregular movements
function detectIrregularities(options, expiryStats) {
  const alerts = [];
  
  options.forEach(opt => {
    const expiry = parseExpiryDate(opt.instrument_name);
    const stats = expiryStats[expiry];
    
    if (!stats || opt.mark_price <= 0 || opt.volume_usd <= 0) {
      return;
    }
    
    const priceRatio = opt.mark_price / stats.avgPrice;
    const volumeRatio = opt.volume_usd / stats.avgVolume;
    
    // Detect extreme movements
    const isExtremePriceSpike = priceRatio >= 3.0;
    const isExtremePriceDrop = priceRatio <= 0.5;
    const isExtremeVolumeSpike = volumeRatio >= 5.0;
    const isCombinedAnomaly = (priceRatio >= 2.5 || priceRatio <= 0.6) && 
                              (volumeRatio >= 4.0 || volumeRatio <= 0.6);
    
    if (isExtremePriceSpike || isExtremePriceDrop || isExtremeVolumeSpike || isCombinedAnomaly) {
      alerts.push({
        symbol: opt.instrument_name,
        currentPrice: opt.mark_price,
        priceRatio: priceRatio,
        volumeRatio: volumeRatio,
        timestamp: new Date().toLocaleString(),
        expiryDate: expiry,
        type: isExtremePriceSpike ? 'PRICE_SPIKE' :
              isExtremePriceDrop ? 'PRICE_DROP' :
              isExtremeVolumeSpike ? 'VOLUME_SPIKE' : 'COMBINED'
      });
    }
  });
  
  return alerts;
}

// Main monitoring function
export async function monitorOptions() {
  const startTime = Date.now();
  
  try {
    console.log('📊 Fetching options data from Deribit...');
    const options = await fetchOptionsData();
    console.log(`✅ Fetched ${options.length} options`);
    
    // Calculate statistics
    const { expiryGroups, expiryStats } = calculateExpiryStats(options);
    console.log(`📈 Analyzing ${Object.keys(expiryGroups).length} expiry dates`);
    
    // Detect irregularities
    const alerts = detectIrregularities(options, expiryStats);
    console.log(`🔍 Found ${alerts.length} irregularities`);
    
    // Group alerts by expiry
    const alertsByExpiry = {};
    alerts.forEach(alert => {
      if (!alertsByExpiry[alert.expiryDate]) {
        alertsByExpiry[alert.expiryDate] = [];
      }
      alertsByExpiry[alert.expiryDate].push(alert);
    });
    
    // Send alerts for each expiry (respecting cooldown)
    let emailsSent = 0;
    for (const [expiry, expiryAlerts] of Object.entries(alertsByExpiry)) {
      if (shouldSendAlert(expiry)) {
        console.log(`📧 Sending alert for expiry ${expiry} (${expiryAlerts.length} irregularities)`);
        
        const success = await sendAlertEmail(expiryAlerts, expiry);
        
        if (success) {
          recordAlertSent(expiry, expiryAlerts);
          emailsSent++;
        }
      } else {
        console.log(`⏳ Skipping alert for ${expiry} (cooldown active)`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Update status
    updateMonitorStatus({
      lastCheck: new Date().toISOString(),
      optionsChecked: options.length,
      irregularitiesFound: alerts.length,
      emailsSent: emailsSent,
      checkDuration: duration
    });
    
    console.log(`✅ Check completed in ${duration}ms`);
    console.log(`📧 Emails sent: ${emailsSent}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error in monitoring:', error);
    
    updateMonitorStatus({
      lastCheck: new Date().toISOString(),
      error: error.message
    });
    
    throw error;
  }
}