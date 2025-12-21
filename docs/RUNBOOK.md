# 0xCultiv8 Operations Runbook

## Table of Contents
1. [System Overview](#system-overview)
2. [Emergency Procedures](#emergency-procedures)
3. [Incident Response](#incident-response)
4. [Common Issues & Resolutions](#common-issues--resolutions)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Deployment Procedures](#deployment-procedures)
7. [Database Operations](#database-operations)
8. [Security Procedures](#security-procedures)

---

## System Overview

### Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Layer     │────▶│   Database      │
│   (React 19)    │     │   (Hono.js)     │     │   (PostgreSQL)  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │LangGraph │ │ Protocol │ │   MCP    │
              │  Agent   │ │ Adapters │ │ Servers  │
              └────┬─────┘ └────┬─────┘ └──────────┘
                   │            │
                   ▼            ▼
              ┌─────────────────────────────┐
              │     Smart Contracts         │
              │  (Ethereum / Base)          │
              └─────────────────────────────┘
```

### Key Components
| Component | Port | Description |
|-----------|------|-------------|
| Web App | 3000 | Main application |
| Redis | 6379 | Caching layer |
| PostgreSQL | 5432 | Primary database |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Dashboards |

### Critical Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Blockchain
ETHEREUM_RPC_URL=https://...
BASE_RPC_URL=https://...

# AI Models
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Security
KEY_MANAGER_BACKEND=aws_kms  # or vault
AGENT_PRIVATE_KEY=...  # (dev only, use KMS in prod)

# Alerting
SLACK_WEBHOOK_URL=https://...
PAGERDUTY_INTEGRATION_KEY=...
```

---

## Emergency Procedures

### 1. Emergency Pause (Circuit Breaker)

**When to use:** Suspected attack, system malfunction, or critical bug discovered.

**API Method:**
```bash
curl -X POST https://cultiv8.xyz/api/emergency/pause \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Description of the emergency"}'
```

**Database Method (if API unavailable):**
```sql
UPDATE agent_config
SET emergency_pause = true,
    pause_reason = 'Manual emergency pause',
    paused_at = NOW();
```

**Effects:**
- All investment operations blocked
- Withdrawals still allowed (users can exit)
- Circuit breaker alerts triggered
- Audit log entry created

### 2. Resume Operations

**Only after confirming issue is resolved:**
```bash
curl -X POST https://cultiv8.xyz/api/emergency/resume \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"authorized_by": "your_name"}'
```

### 3. Smart Contract Emergency

**Pause smart contracts (requires owner key):**
```javascript
// Using ethers.js
const agent = new ethers.Contract(AGENT_ADDRESS, AGENT_ABI, signer);
await agent.setPaused(true);

const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
await vault.setPaused(true);
```

---

## Incident Response

### Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| P1 - Critical | 15 min | Funds at risk, complete outage |
| P2 - High | 1 hour | Partial outage, degraded service |
| P3 - Medium | 4 hours | Single feature down |
| P4 - Low | 24 hours | Minor issues |

### P1 Response Checklist

1. [ ] Acknowledge alert (PagerDuty)
2. [ ] Join incident channel (#cultiv8-incidents)
3. [ ] Assess scope and impact
4. [ ] Trigger emergency pause if funds at risk
5. [ ] Notify stakeholders
6. [ ] Begin investigation
7. [ ] Implement fix or workaround
8. [ ] Verify resolution
9. [ ] Resume operations
10. [ ] Post-incident review (within 48 hours)

### Incident Communication Template

```
[INCIDENT] P1 - Brief description

Status: INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED
Impact: Describe user impact
Start Time: YYYY-MM-DD HH:MM UTC
Current Time: YYYY-MM-DD HH:MM UTC

Summary:
- What happened
- What we know
- What we're doing

Next Update: In X minutes
```

---

## Common Issues & Resolutions

### 1. Transaction Failures

**Symptoms:** Investment transactions failing repeatedly

**Investigation:**
```bash
# Check circuit breaker status
curl https://cultiv8.xyz/api/agent/status

# Check recent failures
curl https://cultiv8.xyz/api/audit-logs?action=INVESTMENT_FAILED&limit=10
```

**Common Causes:**
- RPC endpoint issues → Check RPC status, switch to backup
- Insufficient gas → Check gas prices, increase multiplier
- Contract paused → Check smart contract pause state
- Daily limit exceeded → Verify user limits

**Resolution:**
1. Identify root cause from error logs
2. Address underlying issue
3. Reset circuit breaker if needed
4. Monitor for recurrence

### 2. High Latency

**Symptoms:** API response times > 2 seconds

**Investigation:**
```bash
# Check metrics
curl https://cultiv8.xyz/api/metrics

# Check database connection pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE application_name = 'cultiv8';"
```

**Common Causes:**
- Database connection exhaustion → Increase pool size, check for leaks
- Redis unavailable → Check Redis health, restart if needed
- LLM API slowness → Check Anthropic/OpenAI status
- Heavy load → Scale horizontally

### 3. Authentication Failures

**Symptoms:** Users unable to sign in

**Investigation:**
```bash
# Check recent auth logs
curl https://cultiv8.xyz/api/audit-logs?action=AUTH_FAILED&limit=20
```

**Common Causes:**
- JWT secret rotation issue → Verify SESSION_SECRET
- Clock drift → Check server time sync
- Rate limiting triggered → Review rate limit config

### 4. MEV Attack Detected

**Symptoms:** Alert from MEV protection system

**Response:**
1. Check transaction details in alert
2. Verify if actual attack or false positive
3. If real attack, investigate transaction path
4. Consider adjusting slippage protection
5. Document in incident log

---

## Monitoring & Alerting

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| API Response Time | > 1s | > 3s |
| Error Rate | > 1% | > 5% |
| Database Connections | > 80% | > 95% |
| Redis Memory | > 80% | > 95% |
| Circuit Breaker Failures | > 1 | > 2 |

### Alert Channels

| Severity | Channels |
|----------|----------|
| Critical | PagerDuty + Slack + Email |
| High | Slack + Email |
| Medium | Slack |
| Low | Slack |

### Health Check Endpoints

```bash
# Application health
curl https://cultiv8.xyz/api/health

# Database connectivity
curl https://cultiv8.xyz/api/health/db

# Redis connectivity
curl https://cultiv8.xyz/api/health/cache

# RPC connectivity
curl https://cultiv8.xyz/api/health/rpc
```

---

## Deployment Procedures

### Pre-deployment Checklist

1. [ ] All tests passing on CI
2. [ ] Security scan completed
3. [ ] Changelog prepared
4. [ ] Rollback plan documented
5. [ ] Team notified

### Staging Deployment

```bash
# Trigger via GitHub Actions
gh workflow run deploy-staging.yml

# Or manual
cd yieldy/apps/web
npm run build
docker-compose -f ../../infrastructure/docker/docker-compose.staging.yml up -d
```

### Production Deployment

```bash
# Via GitHub Actions with approval
gh workflow run deploy-production.yml -f version_tag=v1.0.0

# Verify deployment
curl https://cultiv8.xyz/api/health
```

### Rollback Procedure

```bash
# Quick rollback to previous version
kubectl rollout undo deployment/cultiv8-web

# Or specific version
kubectl set image deployment/cultiv8-web web=ghcr.io/repo:v0.9.0
```

---

## Database Operations

### Backup Verification

```bash
# Check recent backups (Neon handles automatically)
# For manual backup:
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Schema Migrations

```bash
# Apply pending migrations
cd yieldy/apps/web
npm run migrate:local

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"
```

### Connection Pool Issues

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Kill idle connections (careful!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '1 hour';
```

---

## Security Procedures

### Suspected Breach Response

1. **Immediate Actions (< 15 min):**
   - Trigger emergency pause
   - Revoke compromised credentials
   - Preserve logs and evidence
   - Notify security team

2. **Investigation (< 1 hour):**
   - Identify attack vector
   - Assess scope of compromise
   - Check for unauthorized transactions
   - Review audit logs

3. **Remediation:**
   - Rotate all secrets
   - Patch vulnerability
   - Review access controls
   - Update documentation

### Key Rotation

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Update in secrets manager (KMS/Vault)
# 3. Deploy with new key
# 4. Verify functionality
# 5. Revoke old key after confirmation
```

### Audit Log Review

```bash
# Review security events
curl https://cultiv8.xyz/api/audit-logs?action=SECURITY_EVENT&days=7

# Review authentication failures
curl https://cultiv8.xyz/api/audit-logs?action=AUTH_FAILED&days=1
```

---

## Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | PagerDuty | Auto-escalates after 15 min |
| Security Lead | security@cultiv8.xyz | For security incidents |
| DevOps Lead | devops@cultiv8.xyz | For infrastructure issues |

---

*Last Updated: December 2025*
*Version: 1.0*
