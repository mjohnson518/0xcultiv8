# Cultiv8 Security Model

## Defense in Depth Architecture

Cultiv8 employs multiple layers of security to protect user funds and ensure trustless operation.

## Layer 1: Input Validation

**Technology:** Zod schema validation

**Protection:**
- All user inputs validated before processing
- Ethereum address checksum verification
- SQL injection prevention
- Amount bounds checking (min/max)
- Type safety enforcement

**Files:**
- `app/api/middleware/validation.js`
- `app/api/schemas/*.js`

## Layer 2: Rate Limiting

**Technology:** Redis-backed rate limiter

**Protection:**
- DoS attack prevention
- Automated abuse detection
- Tiered limits by operation type
- IP + wallet + user combined limiting

**Limits:**
- General API: 100 requests/hour
- Investments: 10 requests/hour
- Withdrawals: 5 requests/hour

**Files:**
- `app/api/middleware/rateLimit.js`

## Layer 3: Authentication & Authorization

**Technology:** JWT + Wallet signatures (EIP-191)

**Protection:**
- User identity verification
- Role-based access control (user vs admin)
- Nonce-based replay protection
- Session management

**Admin-Only Operations:**
- Fund management
- Emergency pause/resume
- Protocol whitelisting
- Audit log access

**Files:**
- `app/api/middleware/auth.js`
- `app/api/utils/walletAuth.js`

## Layer 4: Smart Contract Security

**Technology:** Solidity 0.8.20 + OpenZeppelin

**Protection:**
- ReentrancyGuard on all state-changing functions
- Ownable for admin functions
- SafeERC20 for token transfers
- Integer overflow protection (Solidity 0.8+)

**EIP-8004 Authorization:**
- Per-transaction limits (min $100, max $1M)
- Daily spending limits
- Instant revocation
- Protocol whitelist

**Security Features:**
```solidity
// Per-transaction limit
require(amount <= auth.maxAmountPerTx, "Exceeds per-transaction limit");

// Daily limit with automatic reset
uint256 currentDay = block.timestamp / 1 days;
if (currentDay > auth.lastResetDay) {
    auth.dailySpent = 0;
}
require(auth.dailySpent + amount <= auth.dailyLimit, "Exceeds daily limit");

// Protocol whitelist
require(whitelistedProtocols[protocol], "Protocol not whitelisted");
```

**Files:**
- `contracts/Cultiv8Agent.sol`
- `contracts/AgentVault.sol`

## Layer 5: Circuit Breaker

**Technology:** Failure detection pattern

**Protection:**
- Automatic pause on repeated failures
- Threshold: 3 failures in 10 minutes
- Blocks new investments (allows withdrawals)
- Manual emergency pause capability

**Triggers:**
- Investment transaction failures
- Scan failures
- Unusual patterns detected

**Files:**
- `app/api/utils/circuitBreaker.js`
- `app/api/emergency/*.js`

## Layer 6: Audit Logging

**Technology:** PostgreSQL + structured logging

**Protection:**
- Immutable audit trail
- Complete transaction history
- User action tracking
- Forensic capability

**Logged Events:**
- All financial operations
- Configuration changes
- Authentication events
- Security incidents

**Files:**
- `app/api/utils/auditLogger.js`
- `app/api/audit-logs/route.js`

## Layer 7: Monitoring & Alerting

**Technology:** Winston + Metrics + Health Checks

**Protection:**
- Real-time performance monitoring
- Slow query detection
- Error rate tracking
- Health status verification

**Monitored Systems:**
- Database connectivity
- Redis availability
- RPC endpoint status
- API response times

**Files:**
- `app/api/utils/logger.js`
- `app/api/health/route.js`
- `app/api/metrics/route.js`

## Threat Model & Mitigations

### Threat: Unauthorized Access

**Attack:** Attacker tries to invest without authentication

**Mitigation:**
- JWT authentication required
- Wallet signature verification
- Nonce-based replay protection

**Result:** ❌ Attack blocked at Layer 3

### Threat: Excessive Investment

**Attack:** Attacker tries to invest beyond limits

**Mitigation:**
- Input validation (max $1M)
- Smart contract limits enforcement
- Available funds checking

**Result:** ❌ Attack blocked at Layers 1 & 4

### Threat: DoS Attack

**Attack:** Attacker floods API with requests

**Mitigation:**
- Rate limiting (100 req/hour general)
- Redis-backed distributed limiting
- IP + wallet combined limiting

**Result:** ❌ Attack blocked at Layer 2

### Threat: Smart Contract Exploit

**Attack:** Attacker tries to drain vault

**Mitigation:**
- ReentrancyGuard on all functions
- SafeERC20 for transfers
- Protocol whitelist
- Per-user balance tracking

**Result:** ❌ Attack blocked at Layer 4

### Threat: Malicious Protocol

**Attack:** Agent interacts with malicious contract

**Mitigation:**
- Owner-controlled protocol whitelist
- Only established protocols (Aave, Compound)
- Transaction simulation before execution

**Result:** ❌ Attack blocked at Layer 4

### Threat: Cascading Failures

**Attack:** Repeated failures could drain resources

**Mitigation:**
- Circuit breaker (3 failures → pause)
- Emergency pause mechanism
- Graceful degradation

**Result:** ❌ Attack contained at Layer 5

## Security Best Practices

### For Users

1. **Set Conservative Limits**
   - Start with small per-transaction amounts
   - Set daily limits you're comfortable with
   - Can always increase later

2. **Monitor Regularly**
   - Check execution history
   - Review daily spending
   - Verify strategies match expectations

3. **Revoke When Inactive**
   - Revoke authorization if not actively using
   - Re-authorize when needed
   - Zero cost to revoke and re-authorize

### For Operators

1. **Keep Whitelist Minimal**
   - Only add battle-tested protocols
   - Verify audit history
   - Monitor protocol health

2. **Monitor Metrics**
   - Check `/api/health` regularly
   - Review audit logs for anomalies
   - Set up alerting for critical events

3. **Incident Response**
   - Emergency pause via `/api/emergency/pause`
   - Investigate before resuming
   - Document incidents in audit log

## Audit & Verification

### Smart Contract Audit Status

- **Internal Review:** ✅ Complete
- **Unit Tests:** ✅ 43/43 passing (100%)
- **External Audit:** 🔜 Scheduled
- **Bug Bounty:** 🔜 Launching post-audit

### Code Coverage

- Smart Contracts: >95%
- API Endpoints: >80%
- Critical Paths: 100%

### Security Tools Used

- Hardhat test suite
- Slither static analysis (planned)
- Mythril symbolic execution (planned)
- Manual code review

## Incident Response Plan

### If Security Issue Detected

1. **Immediate:** Trigger emergency pause
2. **Within 1 hour:** Assess scope and impact
3. **Within 6 hours:** Develop and test fix
4. **Within 24 hours:** Deploy fix and resume operations
5. **Within 48 hours:** Post-mortem and prevention measures

### Communication

- Status page for system health
- Email notifications for critical issues
- Discord/Telegram for real-time updates

## Compliance

### Data Protection

- No PII stored on-chain
- Wallet addresses only (public information)
- GDPR compliant (right to erasure not applicable to blockchain)

### Financial Regulations

- Non-custodial (users control funds)
- Transparent fee structure
- Complete audit trail
- KYC/AML not required (decentralized protocol)

## Security Contacts

**Report Security Vulnerabilities:**
- Email: security@cultiv8.xyz
- Bug Bounty: (coming soon)

**Do Not:**
- Disclose publicly before fix
- Exploit vulnerabilities
- Share with others before disclosure

---

**Last Updated:** October 2025  
**Version:** 1.0  
**Next Review:** Q1 2026

