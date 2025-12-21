# Cultiv8 Production Deployment Checklist

This checklist ensures all critical components are properly configured before deploying to production with real user funds.

## Pre-Deployment Requirements

### 1. Smart Contract Deployment

- [ ] **Deploy Cultiv8Agent contract**
  ```bash
  # Verify constructor arguments
  npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
  ```

- [ ] **Deploy AgentVault contract**
  - Set correct USDC address for chain
  - Set Cultiv8Agent address as authorized agent

- [ ] **Whitelist protocols on Cultiv8Agent**
  - Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` (Ethereum)
  - Compound V3 Comet: `0xc3d688B66703497DAA19211EEdff47f25384cdc3` (Ethereum)
  - Aave V3 Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` (Base)

- [ ] **Update contract addresses in environment**
  ```
  NEXT_PUBLIC_CULTIV8_AGENT_MAINNET=0x...
  NEXT_PUBLIC_AGENT_VAULT_MAINNET=0x...
  NEXT_PUBLIC_CULTIV8_AGENT_BASE=0x...
  NEXT_PUBLIC_AGENT_VAULT_BASE=0x...
  ```

### 2. Database Setup

- [ ] **Run all migrations**
  ```bash
  DATABASE_URL=your_production_url node scripts/run-migrations.js
  ```

- [ ] **Verify tables exist**
  - `agent_config`
  - `cultiv8_opportunities`
  - `investments`
  - `agent_decisions`
  - `user_authorizations`
  - `management_fees`
  - `performance_fees`
  - `audit_logs`

- [ ] **Create admin user in database**
  ```sql
  INSERT INTO users (address, is_admin) VALUES ('0xYourAdminAddress', true);
  ```

### 3. Environment Variables

#### Required - Core
```
NODE_ENV=production
DATABASE_URL=postgresql://...
AUTH_SECRET=<32+ character random string>
AUTH_URL=https://0xcultiv8.xyz
```

#### Required - Blockchain
```
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
BASE_RPC_URL=https://mainnet.base.org
AGENT_PRIVATE_KEY=<SECURE - use KMS in production>
```

#### Required - Security
```
ADMIN_ADDRESSES=0xAdmin1,0xAdmin2
NEXT_PUBLIC_DEMO_MODE=false  # CRITICAL: Must be false or unset
```

#### Required - Monitoring (at least one)
```
PAGERDUTY_INTEGRATION_KEY=...
SLACK_WEBHOOK_URL=...
DISCORD_WEBHOOK_URL=...
SENDGRID_API_KEY=...
ALERT_TO_EMAILS=admin@cultiv8.xyz
```

#### Optional - Enhanced Security
```
KEY_MANAGER_BACKEND=aws_kms  # or 'vault'
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=...
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=...
```

#### Optional - MEV Protection
```
ENABLE_MEV_PROTECTION=true
FLASHBOTS_RPC_URL=https://rpc.flashbots.net
```

### 4. Security Verification

- [ ] **Verify demo mode is disabled**
  ```bash
  # Should NOT include NEXT_PUBLIC_DEMO_MODE=true
  grep DEMO_MODE .env.production
  ```

- [ ] **Test rate limiting is active**
  ```bash
  # Should get rate limited after 10 requests
  for i in {1..15}; do curl -s https://0xcultiv8.xyz/api/health; done
  ```

- [ ] **Verify CORS is restricted**
  ```bash
  curl -H "Origin: https://malicious.com" https://0xcultiv8.xyz/api/health
  # Should NOT include Access-Control-Allow-Origin: https://malicious.com
  ```

- [ ] **Check authentication is required**
  ```bash
  curl https://0xcultiv8.xyz/api/agent/scan
  # Should return 401 Unauthorized
  ```

### 5. Monitoring Setup

- [ ] **Configure PagerDuty**
  - Create service with integration key
  - Set up escalation policy
  - Add on-call schedule

- [ ] **Configure Slack alerts**
  - Create `#cultiv8-alerts` channel
  - Add incoming webhook

- [ ] **Test alerting**
  ```bash
  curl -X POST https://0xcultiv8.xyz/api/test-alert
  # Verify alert received in all channels
  ```

### 6. Health Checks

- [ ] **Configure Railway health checks**
  - Endpoint: `/api/health`
  - Interval: 30 seconds
  - Timeout: 10 seconds

- [ ] **Verify health endpoint returns 200**
  ```bash
  curl https://0xcultiv8.xyz/api/health
  # Should return { "status": "ok", ... }
  ```

### 7. Backup & Recovery

- [ ] **Enable Neon database backups**
  - Point-in-time recovery enabled
  - Daily snapshots configured

- [ ] **Document recovery procedure**
  - Database restore process
  - Contract pause procedure
  - Incident response contacts

## Go-Live Checklist

### Day of Launch

1. [ ] Verify all environment variables are set
2. [ ] Run database migrations
3. [ ] Deploy smart contracts (if not already)
4. [ ] Whitelist protocols on contracts
5. [ ] Test authorization flow end-to-end
6. [ ] Test investment flow with small amount
7. [ ] Verify monitoring alerts are firing
8. [ ] Enable auto-scaling if needed

### Post-Launch Monitoring (First 24 Hours)

- [ ] Monitor error rates in logs
- [ ] Check circuit breaker hasn't tripped
- [ ] Verify transaction success rate
- [ ] Monitor gas costs
- [ ] Check database connection pool usage

## Emergency Procedures

### Circuit Breaker Triggered
```bash
# Check status
curl https://0xcultiv8.xyz/api/emergency/status

# Resume operations (admin only)
curl -X POST https://0xcultiv8.xyz/api/emergency/resume \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Pause All Operations
```bash
curl -X POST https://0xcultiv8.xyz/api/emergency/pause \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Security concern"}'
```

### Revoke User Authorization (On-chain)
```javascript
// Using ethers.js
const cultiv8Agent = new Contract(address, abi, adminSigner);
await cultiv8Agent.setPaused(true);
```

## Support Contacts

- **Technical Lead**: [Your Name]
- **On-Call**: PagerDuty schedule
- **Security Issues**: security@cultiv8.xyz

---

**Last Updated**: 2024-12-21
**Version**: 1.0
