# Cultiv8 Production Alerting Runbook

## Overview

This document describes the production alerting system for the Cultiv8 DeFi platform. The alerting system monitors critical operations and notifies on-call engineers when issues require attention.

## Alert Channels

| Channel | Purpose | Severity Levels | SLA |
|---------|---------|-----------------|-----|
| PagerDuty | On-call paging | CRITICAL | 5 min response |
| Slack | Team notification | CRITICAL, HIGH, MEDIUM, LOW | 15 min response |
| Discord | Community notification | CRITICAL | Informational |
| Email | Backup notification | CRITICAL, HIGH | 30 min response |

## Severity Levels

### CRITICAL (Immediate Action Required)
- System-wide outages
- Smart contract vulnerabilities
- Circuit breaker triggered
- Security breaches
- MEV attacks with significant loss

**Response Time:** 5 minutes
**Escalation:** Page all on-call engineers

### HIGH (Urgent Attention)
- Transaction failures
- Rate limit exceeded
- Large fund movements (>$100k)
- API degradation

**Response Time:** 15 minutes
**Escalation:** Slack + Email

### MEDIUM (Should Address Soon)
- Performance degradation
- Non-critical errors
- Configuration warnings
- Rate limit approaching

**Response Time:** 1 hour
**Escalation:** Slack only

### LOW/INFO (Informational)
- System recovered
- Scheduled maintenance
- Non-urgent notifications

**Response Time:** Next business day
**Escalation:** Slack only

## Alert Types

### Circuit Breaker Triggered
**Type:** `circuit_breaker`
**Severity:** CRITICAL

**What it means:** The circuit breaker has activated, halting all automated operations.

**Response Steps:**
1. Check the circuit breaker dashboard
2. Review recent transaction logs
3. Identify the trigger cause (error rate, latency, etc.)
4. Fix underlying issue
5. Manually reset circuit breaker if safe
6. Monitor for recurrence

### Transaction Failure
**Type:** `transaction_failure`
**Severity:** HIGH

**What it means:** An on-chain transaction has failed.

**Response Steps:**
1. Get transaction hash from alert context
2. Check transaction on block explorer
3. Identify failure reason (gas, revert, etc.)
4. Check if funds are affected
5. Retry if appropriate
6. Update user if needed

### Security Event
**Type:** `security_event`
**Severity:** CRITICAL

**What it means:** A security-related event has been detected.

**Response Steps:**
1. DO NOT share details publicly
2. Assess scope of potential breach
3. Consider emergency shutdown if needed
4. Notify security team lead
5. Preserve logs for forensics
6. Follow incident response procedure

### MEV Detected
**Type:** `mev_detected`
**Severity:** HIGH

**What it means:** A potential MEV (Maximal Extractable Value) attack has been detected.

**Response Steps:**
1. Review transaction details
2. Assess actual vs estimated loss
3. Consider pausing auto-execution
4. Review MEV protection settings
5. Report to security team

### Large Fund Movement
**Type:** `fund_movement`
**Severity:** HIGH/MEDIUM

**What it means:** A large deposit or withdrawal has occurred.

**Response Steps:**
1. Verify transaction is legitimate
2. Check for anomalous patterns
3. Confirm with user if needed (for withdrawals)
4. Update internal tracking

### Rate Limit Exceeded
**Type:** `rate_limit`
**Severity:** MEDIUM

**What it means:** An API rate limit has been exceeded.

**Response Steps:**
1. Identify source of requests
2. Check for abuse or misconfiguration
3. Consider temporary blocking
4. Adjust rate limits if legitimate

## Configuration

### Required Environment Variables

```bash
# PagerDuty
PAGERDUTY_INTEGRATION_KEY=<your-key>

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_ALERT_CHANNEL=#cultiv8-alerts

# Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Email (SendGrid)
SENDGRID_API_KEY=SG....
ALERT_FROM_EMAIL=alerts@cultiv8.xyz
ALERT_TO_EMAILS=oncall@cultiv8.xyz,security@cultiv8.xyz

# Service
SERVICE_NAME=cultiv8-agent
NODE_ENV=production
```

### Testing Configuration

Run the test script to verify all channels:

```bash
node scripts/test-alerting.js
```

Test specific channel:

```bash
node scripts/test-alerting.js --channel=slack
```

Dry run (check configuration only):

```bash
node scripts/test-alerting.js --dry-run
```

## On-Call Procedures

### Rotation Schedule
- Primary on-call: Weekly rotation
- Secondary backup: Always available
- Escalation: After 15 min no response

### Handoff Checklist
- [ ] Review any open incidents
- [ ] Check recent alert trends
- [ ] Verify PagerDuty app installed
- [ ] Confirm phone number is current
- [ ] Test alert reception

### Incident Response
1. Acknowledge alert in PagerDuty
2. Post in #incidents Slack channel
3. Assess severity and scope
4. Begin troubleshooting
5. Update stakeholders every 15 min
6. Document resolution
7. Create postmortem if needed

## Escalation Matrix

| Time Since Alert | Action |
|-----------------|--------|
| 0-5 min | PagerDuty pages primary on-call |
| 5-15 min | PagerDuty pages secondary on-call |
| 15-30 min | Email to engineering leads |
| 30+ min | Phone call to CTO |

## Alert Deduplication

Alerts are deduplicated within a 5-minute window to prevent alert fatigue. Key behavior:

- First occurrence: Always sent
- Subsequent: Suppressed (except every 10th)
- CRITICAL: Never suppressed
- Scoped by user/resource to prevent cross-user suppression

## Maintenance Windows

During scheduled maintenance:
1. Create maintenance window in PagerDuty
2. Post in #engineering Slack
3. Update status page
4. Alerts are still logged but not paged

## Dashboard Links

- [PagerDuty Dashboard](https://cultiv8.pagerduty.com)
- [Grafana Alerts](https://grafana.cultiv8.xyz/alerting)
- [Status Page](https://status.cultiv8.xyz)
- [Transaction Explorer](https://cultiv8.xyz/admin/transactions)

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | PagerDuty Schedule |
| Engineering Lead | Via Slack @eng-leads |
| Security Team | security@cultiv8.xyz |
| CTO | Emergency phone |

---

Last Updated: December 2024
