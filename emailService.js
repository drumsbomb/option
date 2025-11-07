import fetch from 'node-fetch';

const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export async function sendAlertEmail(alerts, expiryDate) {
  const recipientEmail = process.env.RECIPIENT_EMAIL;
  
  if (!recipientEmail || recipientEmail === 'your.email@example.com') {
    console.log('⚠️  Email not configured, skipping alert');
    return false;
  }
  
  try {
    // Group alerts by type
    const extremePriceSpikes = alerts.filter(a => a.priceRatio >= 3.0);
    const extremePriceDrops = alerts.filter(a => a.priceRatio <= 0.5);
    const extremeVolumeSpikes = alerts.filter(a => a.volumeRatio >= 5.0);
    const combinedAnomalies = alerts.filter(a => 
      (a.priceRatio >= 2.5 || a.priceRatio <= 0.6) && 
      (a.volumeRatio >= 4.0 || a.volumeRatio <= 0.6)
    );
    
    // Create detailed message
    const message = `
🚨 ETH Options Alert - Expiry ${expiryDate}

Detected ${alerts.length} irregularities:
• ${extremePriceSpikes.length} extreme price spikes (3x+ above average)
• ${extremePriceDrops.length} extreme price drops (50%+ below average)
• ${extremeVolumeSpikes.length} extreme volume spikes (5x+ above average)
• ${combinedAnomalies.length} combined anomalies

📊 Top 5 Most Significant:
${alerts.slice(0, 5).map((a, i) => 
  `${i + 1}. ${a.symbol}
   Price: ${a.currentPrice.toFixed(4)} ETH (${a.priceRatio.toFixed(2)}x avg)
   Volume: ${a.volumeRatio.toFixed(2)}x average`
).join('\n\n')}

⏰ Timestamp: ${alerts[0].timestamp}

---
This is an automated alert from your ETH Options Monitor.
    `.trim();
    
    const payload = {
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: recipientEmail,
        from_name: 'ETH Options Monitor (Backend)',
        message: message
      }
    };
    
    console.log(`📤 Sending email to ${recipientEmail}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(EMAILJS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Email sent successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ EmailJS API error:', response.status, errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return false;
  }
}