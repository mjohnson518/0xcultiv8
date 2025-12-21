/**
 * Alerting System for Production Monitoring
 * Supports multiple channels: PagerDuty, Slack, Discord, Email
 *
 * @module alerting
 */

import { log } from './logger.js';

/**
 * Alert severity levels
 */
export const SEVERITY = {
  CRITICAL: 'critical',  // Immediate action required (PagerDuty + all channels)
  HIGH: 'high',          // Urgent attention needed (Slack + Email)
  MEDIUM: 'medium',      // Should be addressed soon (Slack)
  LOW: 'low',            // Informational (Slack or logging only)
  INFO: 'info',          // For tracking purposes only
};

/**
 * Alert types for categorization
 */
export const ALERT_TYPES = {
  CIRCUIT_BREAKER: 'circuit_breaker',
  TRANSACTION_FAILURE: 'transaction_failure',
  SECURITY_EVENT: 'security_event',
  SYSTEM_ERROR: 'system_error',
  PERFORMANCE: 'performance',
  SMART_CONTRACT: 'smart_contract',
  MEV_DETECTED: 'mev_detected',
  RATE_LIMIT: 'rate_limit',
  FUND_MOVEMENT: 'fund_movement',
};

/**
 * Alert deduplication cache
 * Key: dedupe_key, Value: { count, firstSeen, lastSeen }
 */
const alertCache = new Map();
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up expired dedupe entries
 */
function cleanupDedupeCache() {
  const now = Date.now();
  for (const [key, value] of alertCache.entries()) {
    if (now - value.lastSeen > DEDUPE_WINDOW_MS) {
      alertCache.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupDedupeCache, 60 * 1000);

/**
 * AlertManager - Handles sending alerts to multiple channels
 */
export class AlertManager {
  constructor(config = {}) {
    this.config = {
      // PagerDuty configuration
      pagerduty: {
        enabled: !!process.env.PAGERDUTY_INTEGRATION_KEY,
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
        endpoint: 'https://events.pagerduty.com/v2/enqueue',
      },

      // Slack configuration
      slack: {
        enabled: !!process.env.SLACK_WEBHOOK_URL,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_ALERT_CHANNEL || '#cultiv8-alerts',
      },

      // Discord configuration
      discord: {
        enabled: !!process.env.DISCORD_WEBHOOK_URL,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      },

      // Email configuration (SendGrid)
      email: {
        enabled: !!process.env.SENDGRID_API_KEY,
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.ALERT_FROM_EMAIL || 'alerts@cultiv8.xyz',
        toEmails: (process.env.ALERT_TO_EMAILS || '').split(',').filter(Boolean),
      },

      // Override with provided config
      ...config,
    };

    this.serviceName = process.env.SERVICE_NAME || 'cultiv8-agent';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Send an alert to appropriate channels based on severity
   * @param {object} alert - Alert details
   * @param {string} alert.title - Alert title
   * @param {string} alert.message - Alert message
   * @param {string} alert.severity - Alert severity (SEVERITY enum)
   * @param {string} alert.type - Alert type (ALERT_TYPES enum)
   * @param {object} alert.context - Additional context data
   * @param {string} alert.dedupeKey - Optional key for deduplication
   * @returns {Promise<object>} - Result of alert dispatch
   */
  async send(alert) {
    const {
      title,
      message,
      severity = SEVERITY.MEDIUM,
      type = ALERT_TYPES.SYSTEM_ERROR,
      context = {},
      dedupeKey = null,
    } = alert;

    // Deduplication check
    if (dedupeKey) {
      const dedupeResult = this.checkDedupe(dedupeKey, severity);
      if (dedupeResult.suppressed) {
        log.debug('Alert suppressed by deduplication', { dedupeKey, count: dedupeResult.count });
        return { success: true, suppressed: true, count: dedupeResult.count };
      }
    }

    const enrichedAlert = {
      title,
      message,
      severity,
      type,
      context: {
        ...context,
        service: this.serviceName,
        environment: this.environment,
        timestamp: new Date().toISOString(),
      },
      dedupeKey,
    };

    log.info('Sending alert', { title, severity, type });

    const results = await this.dispatchToChannels(enrichedAlert);

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Check if alert should be deduplicated
   */
  checkDedupe(key, severity) {
    const now = Date.now();
    const existing = alertCache.get(key);

    if (!existing || now - existing.lastSeen > DEDUPE_WINDOW_MS) {
      // First occurrence or expired
      alertCache.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        severity,
      });
      return { suppressed: false, count: 1 };
    }

    // Increment count
    existing.count++;
    existing.lastSeen = now;

    // Allow critical alerts through every time
    if (severity === SEVERITY.CRITICAL) {
      return { suppressed: false, count: existing.count };
    }

    // Suppress if within window (but allow periodic updates)
    const shouldSuppress = existing.count > 1 && existing.count % 10 !== 0;
    return { suppressed: shouldSuppress, count: existing.count };
  }

  /**
   * Dispatch alert to appropriate channels based on severity
   */
  async dispatchToChannels(alert) {
    const results = [];
    const { severity } = alert;

    // Critical: All channels
    if (severity === SEVERITY.CRITICAL) {
      results.push(
        await this.sendToPagerDuty(alert),
        await this.sendToSlack(alert),
        await this.sendToDiscord(alert),
        await this.sendToEmail(alert),
      );
    }
    // High: Slack + Email
    else if (severity === SEVERITY.HIGH) {
      results.push(
        await this.sendToSlack(alert),
        await this.sendToEmail(alert),
      );
    }
    // Medium: Slack only
    else if (severity === SEVERITY.MEDIUM) {
      results.push(await this.sendToSlack(alert));
    }
    // Low/Info: Slack only (with reduced visibility)
    else {
      results.push(await this.sendToSlack(alert));
    }

    return results;
  }

  /**
   * Send alert to PagerDuty
   */
  async sendToPagerDuty(alert) {
    if (!this.config.pagerduty.enabled) {
      log.debug('PagerDuty not configured, skipping');
      return { channel: 'pagerduty', success: false, reason: 'not_configured' };
    }

    try {
      const payload = {
        routing_key: this.config.pagerduty.integrationKey,
        event_action: 'trigger',
        dedup_key: alert.dedupeKey || `${alert.type}-${Date.now()}`,
        payload: {
          summary: `[${this.environment.toUpperCase()}] ${alert.title}`,
          source: this.serviceName,
          severity: this.mapSeverityToPagerDuty(alert.severity),
          timestamp: alert.context.timestamp,
          component: alert.type,
          group: this.environment,
          class: alert.type,
          custom_details: {
            message: alert.message,
            ...alert.context,
          },
        },
        links: [
          {
            href: `https://cultiv8.xyz/admin/alerts`,
            text: 'View in Dashboard',
          },
        ],
      };

      const response = await fetch(this.config.pagerduty.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API returned ${response.status}`);
      }

      log.info('Alert sent to PagerDuty', { title: alert.title });
      return { channel: 'pagerduty', success: true };
    } catch (error) {
      log.error('Failed to send PagerDuty alert', { error: error.message });
      return { channel: 'pagerduty', success: false, error: error.message };
    }
  }

  /**
   * Send alert to Slack
   */
  async sendToSlack(alert) {
    if (!this.config.slack.enabled) {
      log.debug('Slack not configured, skipping');
      return { channel: 'slack', success: false, reason: 'not_configured' };
    }

    try {
      const color = this.getSeverityColor(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);

      const payload = {
        channel: this.config.slack.channel,
        username: 'Cultiv8 Alerts',
        icon_emoji: ':robot_face:',
        attachments: [
          {
            color,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `${emoji} ${alert.title}`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: alert.message,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Severity:*\n${alert.severity.toUpperCase()}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Type:*\n${alert.type}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Environment:*\n${alert.context.environment}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Service:*\n${alert.context.service}`,
                  },
                ],
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Triggered at: ${alert.context.timestamp}`,
                  },
                ],
              },
            ],
          },
        ],
      };

      // Add context details if present
      if (Object.keys(alert.context).length > 4) {
        const contextDetails = Object.entries(alert.context)
          .filter(([key]) => !['service', 'environment', 'timestamp'].includes(key))
          .map(([key, value]) => `• *${key}:* ${JSON.stringify(value)}`)
          .join('\n');

        if (contextDetails) {
          payload.attachments[0].blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Additional Context:*\n${contextDetails}`,
            },
          });
        }
      }

      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}`);
      }

      log.info('Alert sent to Slack', { title: alert.title });
      return { channel: 'slack', success: true };
    } catch (error) {
      log.error('Failed to send Slack alert', { error: error.message });
      return { channel: 'slack', success: false, error: error.message };
    }
  }

  /**
   * Send alert to Discord
   */
  async sendToDiscord(alert) {
    if (!this.config.discord.enabled) {
      log.debug('Discord not configured, skipping');
      return { channel: 'discord', success: false, reason: 'not_configured' };
    }

    try {
      const color = this.getSeverityColorHex(alert.severity);

      const payload = {
        username: 'Cultiv8 Alerts',
        embeds: [
          {
            title: `${this.getSeverityEmoji(alert.severity)} ${alert.title}`,
            description: alert.message,
            color: parseInt(color.replace('#', ''), 16),
            fields: [
              { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
              { name: 'Type', value: alert.type, inline: true },
              { name: 'Environment', value: alert.context.environment, inline: true },
            ],
            timestamp: alert.context.timestamp,
            footer: {
              text: `Cultiv8 Agent | ${alert.context.service}`,
            },
          },
        ],
      };

      const response = await fetch(this.config.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord API returned ${response.status}`);
      }

      log.info('Alert sent to Discord', { title: alert.title });
      return { channel: 'discord', success: true };
    } catch (error) {
      log.error('Failed to send Discord alert', { error: error.message });
      return { channel: 'discord', success: false, error: error.message };
    }
  }

  /**
   * Send alert via Email (SendGrid)
   */
  async sendToEmail(alert) {
    if (!this.config.email.enabled || this.config.email.toEmails.length === 0) {
      log.debug('Email not configured, skipping');
      return { channel: 'email', success: false, reason: 'not_configured' };
    }

    try {
      const severity = alert.severity.toUpperCase();
      const emoji = this.getSeverityEmoji(alert.severity);

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${this.getSeverityColorHex(alert.severity)}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">${emoji} ${alert.title}</h1>
          </div>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">${alert.message}</p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Severity</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${severity}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Type</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${alert.type}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Environment</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${alert.context.environment}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Service</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${alert.context.service}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Time</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${alert.context.timestamp}</td>
              </tr>
            </table>

            ${Object.keys(alert.context).length > 4 ? `
              <div style="background-color: #e8e8e8; padding: 15px; border-radius: 4px;">
                <h3 style="margin-top: 0;">Additional Context</h3>
                <pre style="background-color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alert.context, null, 2)}</pre>
              </div>
            ` : ''}

            <div style="margin-top: 20px; text-align: center;">
              <a href="https://cultiv8.xyz/admin/alerts" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View in Dashboard</a>
            </div>
          </div>
          <div style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
            Cultiv8 Agent Alert System
          </div>
        </div>
      `;

      const payload = {
        personalizations: [
          {
            to: this.config.email.toEmails.map(email => ({ email })),
            subject: `[${severity}] ${alert.title} - Cultiv8 Alert`,
          },
        ],
        from: {
          email: this.config.email.fromEmail,
          name: 'Cultiv8 Alerts',
        },
        content: [
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.email.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`SendGrid API returned ${response.status}`);
      }

      log.info('Alert sent via Email', { title: alert.title, recipients: this.config.email.toEmails.length });
      return { channel: 'email', success: true };
    } catch (error) {
      log.error('Failed to send Email alert', { error: error.message });
      return { channel: 'email', success: false, error: error.message };
    }
  }

  /**
   * Map severity to PagerDuty severity
   */
  mapSeverityToPagerDuty(severity) {
    const mapping = {
      [SEVERITY.CRITICAL]: 'critical',
      [SEVERITY.HIGH]: 'error',
      [SEVERITY.MEDIUM]: 'warning',
      [SEVERITY.LOW]: 'info',
      [SEVERITY.INFO]: 'info',
    };
    return mapping[severity] || 'warning';
  }

  /**
   * Get color for severity (Slack attachment)
   */
  getSeverityColor(severity) {
    const colors = {
      [SEVERITY.CRITICAL]: 'danger',
      [SEVERITY.HIGH]: 'danger',
      [SEVERITY.MEDIUM]: 'warning',
      [SEVERITY.LOW]: 'good',
      [SEVERITY.INFO]: '#439FE0',
    };
    return colors[severity] || 'warning';
  }

  /**
   * Get hex color for severity
   */
  getSeverityColorHex(severity) {
    const colors = {
      [SEVERITY.CRITICAL]: '#dc3545',
      [SEVERITY.HIGH]: '#e74c3c',
      [SEVERITY.MEDIUM]: '#f39c12',
      [SEVERITY.LOW]: '#27ae60',
      [SEVERITY.INFO]: '#3498db',
    };
    return colors[severity] || '#f39c12';
  }

  /**
   * Get emoji for severity
   */
  getSeverityEmoji(severity) {
    const emojis = {
      [SEVERITY.CRITICAL]: '🚨',
      [SEVERITY.HIGH]: '⚠️',
      [SEVERITY.MEDIUM]: '⚡',
      [SEVERITY.LOW]: 'ℹ️',
      [SEVERITY.INFO]: '📝',
    };
    return emojis[severity] || '⚡';
  }

  /**
   * Resolve/acknowledge an alert (for PagerDuty)
   */
  async resolve(dedupeKey) {
    if (!this.config.pagerduty.enabled) {
      return { success: false, reason: 'not_configured' };
    }

    try {
      const payload = {
        routing_key: this.config.pagerduty.integrationKey,
        event_action: 'resolve',
        dedup_key: dedupeKey,
      };

      const response = await fetch(this.config.pagerduty.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API returned ${response.status}`);
      }

      log.info('Alert resolved in PagerDuty', { dedupeKey });
      return { success: true };
    } catch (error) {
      log.error('Failed to resolve PagerDuty alert', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
export const alertManager = new AlertManager();

/**
 * Convenience function to send critical alert
 */
export async function alertCritical(title, message, context = {}) {
  return alertManager.send({
    title,
    message,
    severity: SEVERITY.CRITICAL,
    context,
  });
}

/**
 * Convenience function to send high-priority alert
 */
export async function alertHigh(title, message, context = {}) {
  return alertManager.send({
    title,
    message,
    severity: SEVERITY.HIGH,
    context,
  });
}

/**
 * Convenience function to send medium-priority alert
 */
export async function alertMedium(title, message, context = {}) {
  return alertManager.send({
    title,
    message,
    severity: SEVERITY.MEDIUM,
    context,
  });
}

/**
 * Convenience function to send low-priority alert
 */
export async function alertLow(title, message, context = {}) {
  return alertManager.send({
    title,
    message,
    severity: SEVERITY.LOW,
    context,
  });
}

// Pre-defined alert templates
export const ALERT_TEMPLATES = {
  circuitBreakerTripped: (reason, context = {}) => ({
    title: 'Circuit Breaker Triggered',
    message: `Agent operations have been paused. Reason: ${reason}`,
    severity: SEVERITY.CRITICAL,
    type: ALERT_TYPES.CIRCUIT_BREAKER,
    dedupeKey: `circuit-breaker-${reason}`,
    context,
  }),

  transactionFailed: (txHash, error, context = {}) => ({
    title: 'Transaction Execution Failed',
    message: `Transaction ${txHash ? txHash.slice(0, 10) + '...' : 'unknown'} failed: ${error}`,
    severity: SEVERITY.HIGH,
    type: ALERT_TYPES.TRANSACTION_FAILURE,
    dedupeKey: `tx-failure-${txHash || Date.now()}`,
    context: { txHash, error, ...context },
  }),

  securityEvent: (event, context = {}) => ({
    title: 'Security Event Detected',
    message: `A security-related event has been detected: ${event}`,
    severity: SEVERITY.CRITICAL,
    type: ALERT_TYPES.SECURITY_EVENT,
    dedupeKey: `security-${event}`,
    context,
  }),

  mevDetected: (txHash, estimatedLoss, context = {}) => ({
    title: 'MEV Attack Detected',
    message: `Potential MEV attack detected on transaction. Estimated loss: $${estimatedLoss}`,
    severity: SEVERITY.HIGH,
    type: ALERT_TYPES.MEV_DETECTED,
    dedupeKey: `mev-${txHash}`,
    context: { txHash, estimatedLoss, ...context },
  }),

  largeFundMovement: (amount, direction, context = {}) => ({
    title: `Large ${direction === 'in' ? 'Deposit' : 'Withdrawal'} Detected`,
    message: `A large fund movement of $${amount.toLocaleString()} has been detected`,
    severity: amount > 100000 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
    type: ALERT_TYPES.FUND_MOVEMENT,
    dedupeKey: `fund-${direction}-${amount}`,
    context: { amount, direction, ...context },
  }),

  rateLimitExceeded: (identifier, limit, context = {}) => ({
    title: 'Rate Limit Exceeded',
    message: `Rate limit exceeded for ${identifier}. Limit: ${limit}/hour`,
    severity: SEVERITY.MEDIUM,
    type: ALERT_TYPES.RATE_LIMIT,
    dedupeKey: `rate-limit-${identifier}`,
    context: { identifier, limit, ...context },
  }),

  systemRecovered: (component, context = {}) => ({
    title: 'System Recovered',
    message: `${component} has recovered and is operating normally`,
    severity: SEVERITY.INFO,
    type: ALERT_TYPES.SYSTEM_ERROR,
    context: { component, ...context },
  }),
};
