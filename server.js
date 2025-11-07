import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { monitorOptions } from './monitor.js';
import { getMonitorStatus, getAlertHistory } from './state.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const status = getMonitorStatus();
  res.json(status);
});

// Alert history endpoint
app.get('/api/alerts', (req, res) => {
  const history = getAlertHistory();
  res.json(history);
});

// Manual trigger endpoint (for testing)
app.post('/api/trigger-check', async (req, res) => {
  try {
    console.log('📍 Manual check triggered via API');
    await monitorOptions();
    res.json({ 
      success: true, 
      message: 'Check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update email configuration
app.post('/api/config/email', (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email address' 
    });
  }
  
  process.env.RECIPIENT_EMAIL = email;
  console.log(`📧 Email configuration updated to: ${email}`);
  
  res.json({ 
    success: true, 
    message: 'Email updated successfully',
    email 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 ETH Options Monitor Backend Started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`📧 Recipient email: ${process.env.RECIPIENT_EMAIL || 'NOT SET'}`);
  console.log(`⏰ Check interval: ${process.env.CHECK_INTERVAL_MINUTES || 5} minutes`);
  console.log(`🔄 Alert cooldown: ${process.env.ALERT_COOLDOWN_HOURS || 6} hours`);
  console.log('');
  
  // Validate configuration
  if (!process.env.RECIPIENT_EMAIL || process.env.RECIPIENT_EMAIL === 'your.email@example.com') {
    console.warn('⚠️  WARNING: RECIPIENT_EMAIL not configured in .env file');
    console.warn('⚠️  Please set RECIPIENT_EMAIL to receive alerts');
  }
  
  // Schedule monitoring checks
  const interval = process.env.CHECK_INTERVAL_MINUTES || 5;
  const cronExpression = `*/${interval} * * * *`; // Every N minutes
  
  console.log(`⏰ Scheduling checks with cron: ${cronExpression}`);
  
  cron.schedule(cronExpression, async () => {
    console.log(`\n🔍 [${new Date().toISOString()}] Running scheduled options check...`);
    try {
      await monitorOptions();
    } catch (error) {
      console.error('❌ Error in scheduled check:', error);
    }
  });
  
  // Run initial check after 10 seconds
  setTimeout(async () => {
    console.log('\n🔍 Running initial options check...');
    try {
      await monitorOptions();
    } catch (error) {
      console.error('❌ Error in initial check:', error);
    }
  }, 10000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});