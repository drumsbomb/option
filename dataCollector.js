import fetch from 'node-fetch';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2';

/**
 * Fetch historical options data for a specific timestamp
 */
export async function fetchHistoricalOptionsData(timestamp) {
  try {
    const response = await fetch(
      `${DERIBIT_API_URL}/public/get_book_summary_by_currency?currency=ETH&kind=option`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      timestamp: timestamp || Date.now(),
      options: data.result || []
    };
  } catch (error) {
    console.error('Error fetching options data:', error);
    throw error;
  }
}

/**
 * Fetch ETH spot price at a specific timestamp
 */
export async function fetchETHPrice(timestamp = null) {
  try {
    const response = await fetch(
      `${DERIBIT_API_URL}/public/get_index_price?index_name=eth_usd`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      timestamp: timestamp || Date.now(),
      price: data.result.index_price
    };
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    throw error;
  }
}

/**
 * Fetch historical ETH price data using trades endpoint
 */
export async function fetchHistoricalETHPrices(startTime, endTime) {
  try {
    const prices = [];
    let currentTime = startTime;
    
    // Fetch in chunks (max 1000 trades per request)
    while (currentTime < endTime) {
      const response = await fetch(
        `${DERIBIT_API_URL}/public/get_last_trades_by_instrument?instrument_name=ETH-PERPETUAL&count=1000&start_timestamp=${currentTime}&end_timestamp=${endTime}`
      );
      
      if (!response.ok) {
        break;
      }
      
      const data = await response.json();
      const trades = data.result.trades || [];
      
      if (trades.length === 0) break;
      
      // Sample prices at regular intervals
      trades.forEach(trade => {
        prices.push({
          timestamp: trade.timestamp,
          price: trade.price
        });
      });
      
      currentTime = trades[trades.length - 1].timestamp + 1;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return prices;
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    return [];
  }
}

/**
 * Parse expiry timestamp from instrument name
 */
export function parseExpiryTimestamp(instrumentName) {
  // Format: ETH-7NOV25-3300-C
  const parts = instrumentName.split('-');
  if (parts.length < 2) return null;
  
  const expiryStr = parts[1]; // e.g., "7NOV25"
  
  // Parse day, month, year
  const day = parseInt(expiryStr.slice(0, -5));
  const monthStr = expiryStr.slice(-5, -2);
  const year = 2000 + parseInt(expiryStr.slice(-2));
  
  const monthMap = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };
  
  const month = monthMap[monthStr];
  if (month === undefined) return null;
  
  // Deribit options expire at 08:00 UTC
  const expiryDate = new Date(Date.UTC(year, month, day, 8, 0, 0));
  return expiryDate.getTime();
}

/**
 * Calculate time to expiry in hours
 */
export function getTimeToExpiry(instrumentName, currentTimestamp) {
  const expiryTimestamp = parseExpiryTimestamp(instrumentName);
  if (!expiryTimestamp) return null;
  
  const hoursToExpiry = (expiryTimestamp - currentTimestamp) / (1000 * 60 * 60);
  return Math.max(0, hoursToExpiry);
}

/**
 * Collect snapshot of current market state
 */
export async function collectMarketSnapshot() {
  try {
    const [optionsData, ethPrice] = await Promise.all([
      fetchHistoricalOptionsData(),
      fetchETHPrice()
    ]);
    
    return {
      timestamp: Date.now(),
      ethPrice: ethPrice.price,
      options: optionsData.options.map(opt => ({
        instrument: opt.instrument_name,
        markPrice: opt.mark_price,
        volume: opt.volume_usd,
        openInterest: opt.open_interest,
        bidPrice: opt.bid_price,
        askPrice: opt.ask_price,
        timeToExpiry: getTimeToExpiry(opt.instrument_name, Date.now())
      }))
    };
  } catch (error) {
    console.error('Error collecting market snapshot:', error);
    throw error;
  }
}