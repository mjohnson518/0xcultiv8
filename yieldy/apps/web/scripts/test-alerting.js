#!/usr/bin/env node

/**
 * Production Alerting Test Script
 *
 * This script tests that all alerting channels are properly configured
 * and can successfully send test alerts.
 *
 * Usage:
 *   node scripts/test-alerting.js
 *   node scripts/test-alerting.js --channel slack
 *   node scripts/test-alerting.js --channel pagerduty
 *   node scripts/test-alerting.js --channel discord
 *   node scripts/test-alerting.js --channel email
 *   node scripts/test-alerting.js --dry-run
 */

import {
  AlertManager,
  SEVERITY,
  ALERT_TYPES,
  ALERT_TEMPLATES
} from '../src/app/api/utils/alerting.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const channelArg = args.find(arg => arg.startsWith('--channel='));
const targetChannel = channelArg ? channelArg.split('=')[1] : 'all';

console.log('\n🔔 Cultiv8 Alerting System Test\n');
console.log('================================\n');

const alertManager = new AlertManager();

// Configuration status
console.log('📋 Configuration Status:\n');

const channels = [
  {
    name: 'PagerDuty',
    key: 'pagerduty',
    configured: !!process.env.PAGERDUTY_INTEGRATION_KEY,
    envVar: 'PAGERDUTY_INTEGRATION_KEY',
  },
  {
    name: 'Slack',
    key: 'slack',
    configured: !!process.env.SLACK_WEBHOOK_URL,
    envVar: 'SLACK_WEBHOOK_URL',
  },
  {
    name: 'Discord',
    key: 'discord',
    configured: !!process.env.DISCORD_WEBHOOK_URL,
    envVar: 'DISCORD_WEBHOOK_URL',
  },
  {
    name: 'Email (SendGrid)',
    key: 'email',
    configured: !!process.env.SENDGRID_API_KEY && !!(process.env.ALERT_TO_EMAILS || '').trim(),
    envVar: 'SENDGRID_API_KEY + ALERT_TO_EMAILS',
  },
];

let configuredCount = 0;
channels.forEach(channel => {
  const status = channel.configured ? '✅' : '❌';
  console.log(`  ${status} ${channel.name}: ${channel.configured ? 'Configured' : `Missing ${channel.envVar}`}`);
  if (channel.configured) configuredCount++;
});

console.log(`\n  Total: ${configuredCount}/${channels.length} channels configured\n`);

if (configuredCount === 0) {
  console.log('⚠️  No alerting channels configured!\n');
  console.log('Please set the required environment variables:');
  console.log('  - PAGERDUTY_INTEGRATION_KEY for PagerDuty');
  console.log('  - SLACK_WEBHOOK_URL for Slack');
  console.log('  - DISCORD_WEBHOOK_URL for Discord');
  console.log('  - SENDGRID_API_KEY + ALERT_TO_EMAILS for Email\n');
  console.log('See .env.alerting.example for details.\n');
  process.exit(1);
}

if (dryRun) {
  console.log('🔍 Dry run mode - no alerts will be sent\n');
  process.exit(0);
}

// Send test alerts
console.log('📤 Sending Test Alerts:\n');

async function testChannel(channelName) {
  const testAlert = {
    title: '🧪 Test Alert - Alerting System Verification',
    message: `This is a test alert from the Cultiv8 alerting system. If you received this, ${channelName} is properly configured!`,
    severity: SEVERITY.LOW,
    type: ALERT_TYPES.SYSTEM_ERROR,
    context: {
      test: true,
      timestamp: new Date().toISOString(),
      triggeredBy: 'test-alerting.js',
    },
    dedupeKey: `test-alert-${Date.now()}`,
  };

  try {
    const result = await alertManager.send(testAlert);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const results = {
    pagerduty: null,
    slack: null,
    discord: null,
    email: null,
  };

  // Test each channel
  for (const channel of channels) {
    if (targetChannel !== 'all' && targetChannel !== channel.key) {
      continue;
    }

    if (!channel.configured) {
      console.log(`  ⏭️  Skipping ${channel.name} (not configured)`);
      continue;
    }

    process.stdout.write(`  🔄 Testing ${channel.name}... `);

    try {
      // Create a channel-specific test alert
      const testAlert = {
        title: `🧪 [TEST] ${channel.name} Verification`,
        message: `Test alert sent at ${new Date().toISOString()}. This confirms ${channel.name} is properly configured for Cultiv8 production alerts.`,
        severity: SEVERITY.LOW,
        type: ALERT_TYPES.SYSTEM_ERROR,
        context: {
          test: true,
          channel: channel.key,
          verificationId: `${channel.key}-${Date.now()}`,
        },
      };

      // Send to specific channel based on severity routing
      // For testing, we'll use the full send which respects severity routing
      // LOW severity only goes to Slack, so we might need to override
      let result;

      if (channel.key === 'slack') {
        result = await alertManager.sendToSlack(testAlert);
      } else if (channel.key === 'discord') {
        result = await alertManager.sendToDiscord(testAlert);
      } else if (channel.key === 'pagerduty') {
        result = await alertManager.sendToPagerDuty(testAlert);
      } else if (channel.key === 'email') {
        result = await alertManager.sendToEmail(testAlert);
      }

      results[channel.key] = result;

      if (result.success) {
        console.log('✅ Success');
      } else {
        console.log(`❌ Failed: ${result.error || result.reason || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results[channel.key] = { success: false, error: error.message };
    }
  }

  // Summary
  console.log('\n================================\n');
  console.log('📊 Test Results Summary:\n');

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const channel of channels) {
    const result = results[channel.key];
    if (!result) {
      skippedCount++;
      continue;
    }

    if (result.success) {
      successCount++;
      console.log(`  ✅ ${channel.name}: Success`);
    } else {
      failedCount++;
      console.log(`  ❌ ${channel.name}: ${result.error || result.reason || 'Failed'}`);
    }
  }

  console.log(`\n  Passed: ${successCount} | Failed: ${failedCount} | Skipped: ${skippedCount}\n`);

  // Test alert templates
  console.log('📋 Available Alert Templates:\n');
  Object.keys(ALERT_TEMPLATES).forEach(template => {
    console.log(`  • ${template}`);
  });

  console.log('\n================================\n');

  // Production readiness assessment
  if (failedCount === 0 && successCount >= 2) {
    console.log('✅ Alerting system is PRODUCTION READY\n');
    console.log('   At least 2 channels are configured and working.\n');
  } else if (successCount >= 1) {
    console.log('⚠️  Alerting system is PARTIALLY READY\n');
    console.log('   Recommend configuring additional channels for redundancy.\n');
  } else {
    console.log('❌ Alerting system is NOT READY\n');
    console.log('   No channels are working. Please check configuration.\n');
    process.exit(1);
  }

  // Recommended next steps
  console.log('📝 Recommended Next Steps:\n');

  if (!process.env.PAGERDUTY_INTEGRATION_KEY) {
    console.log('  1. Configure PagerDuty for on-call escalation');
  }
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.log('  2. Configure Slack for team notifications');
  }
  if (!process.env.SENDGRID_API_KEY) {
    console.log('  3. Configure Email for backup notifications');
  }

  console.log('  • Set up on-call rotation in PagerDuty');
  console.log('  • Create dedicated Slack channels for different severity levels');
  console.log('  • Test critical alert flow with team');
  console.log('  • Document escalation procedures\n');
}

runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
