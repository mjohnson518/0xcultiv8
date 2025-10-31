/**
 * Production Monitoring & Observability
 * Integrates Sentry, custom metrics, and health checks
 */

// Lazy load Sentry (only in production)
let Sentry = null;

/**
 * Initialize monitoring systems
 * Call this in application startup
 */
export function initMonitoring() {
  const isProd = process.env.NODE_ENV === 'production';
  const sentryDSN = process.env.SENTRY_DSN;

  if (isProd && sentryDSN) {
    try {
      // Dynamically import Sentry
      import('@sentry/node').then((SentryModule) => {
        Sentry = SentryModule;
        
        Sentry.init({
          dsn: sentryDSN,
          environment: process.env.SENTRY_ENVIRONMENT || 'production',
          tracesSampleRate: 0.1, // 10% of transactions
          
          // Filter out common noise
          ignoreErrors: [
            'Non-Error promise rejection',
            'ResizeObserver loop limit exceeded',
            'cancelled',
          ],
          
          beforeSend(event) {
            // Don't send test errors
            if (event.request?.url?.includes('/test')) {
              return null;
            }
            return event;
          },
        });

        console.log('✓ Sentry monitoring initialized');
      });
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }
}

/**
 * Capture error with context
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export function captureError(error, context = {}) {
  console.error('Error captured:', error, context);

  if (Sentry) {
    Sentry.captureException(error, {
      extra: context,
    });
  }

  // Also log to custom metrics endpoint if configured
  if (process.env.METRICS_ENDPOINT) {
    fetch(process.env.METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'error',
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      }),
    }).catch(err => console.error('Failed to send metrics:', err));
  }
}

/**
 * Track custom metric
 * @param {string} metricName - Metric name
 * @param {number} value - Metric value
 * @param {object} tags - Additional tags
 */
export function trackMetric(metricName, value, tags = {}) {
  const metric = {
    name: metricName,
    value,
    tags,
    timestamp: new Date().toISOString(),
  };

  // Log locally
  if (process.env.DEBUG_MODE === 'true') {
    console.log('Metric:', metric);
  }

  // Send to custom metrics endpoint
  if (process.env.METRICS_ENDPOINT) {
    fetch(process.env.METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metric', ...metric }),
    }).catch(err => console.error('Failed to send metric:', err));
  }
}

/**
 * Track revenue event
 * @param {object} event - Revenue event details
 */
export function trackRevenue(event) {
  const {
    type, // 'management' | 'performance'
    amount,
    tier,
    userAddress,
  } = event;

  trackMetric('revenue.collected', amount, {
    type,
    tier,
    userAddress,
  });

  console.log(`💰 Revenue collected: $${amount} (${type}, ${tier})`);
}

/**
 * Track tier upgrade
 * @param {object} upgrade - Upgrade details
 */
export function trackTierUpgrade(upgrade) {
  const { from, to, aum, userAddress } = upgrade;

  trackMetric('tier.upgrade', 1, {
    from,
    to,
    aum,
    userAddress,
  });

  console.log(`📈 Tier upgrade: ${from} → ${to} (AUM: $${aum})`);
}

/**
 * Track agent execution
 * @param {object} execution - Execution details
 */
export function trackAgentExecution(execution) {
  const {
    success,
    duration,
    opportunitiesFound,
    strategy,
  } = execution;

  trackMetric('agent.execution', 1, {
    success,
    duration,
    opportunitiesFound,
    strategy: strategy?.protocol,
  });

  console.log(`🤖 Agent execution: ${success ? 'Success' : 'Failed'} (${duration}ms)`);
}

/**
 * Health check for monitoring systems
 * @returns {Promise<object>} Health status
 */
export async function getMonitoringHealth() {
  return {
    sentry: {
      enabled: !!Sentry,
      dsn: process.env.SENTRY_DSN ? 'configured' : 'not configured',
    },
    metrics: {
      endpoint: process.env.METRICS_ENDPOINT ? 'configured' : 'not configured',
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Performance monitoring wrapper
 * @param {string} operationName - Name of operation
 * @param {Function} operation - Async operation to monitor
 * @returns {Promise<any>} Operation result
 */
export async function monitorPerformance(operationName, operation) {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    trackMetric('performance', duration, {
      operation: operationName,
      success: true,
    });

    if (duration > 5000) {
      console.warn(`⚠ Slow operation: ${operationName} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    trackMetric('performance', duration, {
      operation: operationName,
      success: false,
    });

    captureError(error, {
      operation: operationName,
      duration,
    });

    throw error;
  }
}

/**
 * Send alert to configured channels
 * @param {object} alert - Alert details
 */
export async function sendAlert(alert) {
  const {
    severity, // 'info' | 'warning' | 'error' | 'critical'
    title,
    message,
    metadata = {},
  } = alert;

  const alertData = {
    severity,
    title,
    message,
    metadata,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${title}`);
  console.log(`   ${message}`);

  // Send to Slack if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    const color = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000',
      critical: '#990000',
    }[severity];

    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color,
            title: `[${severity.toUpperCase()}] ${title}`,
            text: message,
            fields: Object.entries(metadata).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
            footer: 'Cultiv8 Monitoring',
            ts: Math.floor(Date.now() / 1000),
          }],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  // Send to Discord if configured
  if (process.env.DISCORD_WEBHOOK_URL) {
    const color = {
      info: 0x36a64f,
      warning: 0xff9900,
      error: 0xff0000,
      critical: 0x990000,
    }[severity];

    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `[${severity.toUpperCase()}] ${title}`,
            description: message,
            color,
            fields: Object.entries(metadata).map(([key, value]) => ({
              name: key,
              value: String(value),
              inline: true,
            })),
            footer: {
              text: 'Cultiv8 Monitoring',
            },
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch (error) {
      console.error('Failed to send Discord alert:', error);
    }
  }
}

export default {
  initMonitoring,
  captureError,
  trackMetric,
  trackRevenue,
  trackTierUpgrade,
  trackAgentExecution,
  monitorPerformance,
  sendAlert,
  getMonitoringHealth,
};

