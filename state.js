// In-memory state management
const state = {
  monitorStatus: {
    lastCheck: null,
    optionsChecked: 0,
    irregularitiesFound: 0,
    emailsSent: 0,
    checkDuration: 0,
    error: null
  },
  alertHistory: [],
  lastAlertTime: {} // Track last alert time per expiry
};

export function updateMonitorStatus(status) {
  state.monitorStatus = {
    ...state.monitorStatus,
    ...status
  };
}

export function getMonitorStatus() {
  return {
    ...state.monitorStatus,
    uptime: process.uptime(),
    nextCheck: calculateNextCheck()
  };
}

export function getAlertHistory() {
  return state.alertHistory.slice(-50); // Return last 50 alerts
}

export function shouldSendAlert(expiryDate) {
  const cooldownHours = parseInt(process.env.ALERT_COOLDOWN_HOURS || '6');
  const lastAlert = state.lastAlertTime[expiryDate];
  
  if (!lastAlert) {
    return true;
  }
  
  const hoursSinceLastAlert = (Date.now() - lastAlert) / (1000 * 60 * 60);
  return hoursSinceLastAlert >= cooldownHours;
}

export function recordAlertSent(expiryDate, alerts) {
  state.lastAlertTime[expiryDate] = Date.now();
  
  state.alertHistory.push({
    expiryDate,
    alertCount: alerts.length,
    timestamp: new Date().toISOString(),
    recipientEmail: process.env.RECIPIENT_EMAIL
  });
  
  // Keep only last 100 alerts
  if (state.alertHistory.length > 100) {
    state.alertHistory.shift();
  }
}

function calculateNextCheck() {
  const interval = parseInt(process.env.CHECK_INTERVAL_MINUTES || '5');
  const nextCheck = new Date(Date.now() + interval * 60 * 1000);
  return nextCheck.toISOString();
}