# Security Deep Dive Reference

Comprehensive security analysis covering OWASP Top 10, authentication patterns, cryptography standards, and infrastructure security.

## OWASP Top 10 (2021) Checklist

### A01: Broken Access Control

**Detection Patterns:**
- [ ] Unauthorized access to resources via URL manipulation
- [ ] IDOR (Insecure Direct Object Reference) vulnerabilities
- [ ] Missing function-level access control
- [ ] CORS misconfiguration allowing unauthorized origins
- [ ] JWT manipulation or signature bypass
- [ ] Privilege escalation paths

**Code Patterns to Scan:**
```regex
# Missing authorization checks
@route.*def.*:(?!.*@requires_auth)
# Direct object references
/users/[0-9]+|/orders/[0-9]+|/files/[0-9]+
# Permissive CORS
Access-Control-Allow-Origin.*\*
```

**Remediation:**
- Implement default-deny access control
- Use authorization middleware on all endpoints
- Validate resource ownership in business logic
- Log and alert on access control failures

### A02: Cryptographic Failures

**Detection Patterns:**
- [ ] Sensitive data transmitted in cleartext (HTTP)
- [ ] Weak encryption algorithms (MD5, SHA1, DES, RC4)
- [ ] Hardcoded encryption keys
- [ ] Missing encryption at rest
- [ ] Weak TLS configuration
- [ ] Improper certificate validation

**Code Patterns to Scan:**
```regex
# Weak hashing
hashlib\.md5|hashlib\.sha1|MD5\(|SHA1\(
# HTTP URLs
http://(?!localhost|127\.0\.0\.1)
# Hardcoded keys
["\']key["\']\s*[:=]\s*["\'][A-Za-z0-9+/=]{16,}["\']
```

**Remediation:**
- Use TLS 1.2+ for all data in transit
- Use AES-256-GCM for encryption at rest
- Use bcrypt/Argon2 for password hashing
- Store keys in secret management systems

### A03: Injection

**Detection Patterns:**
- [ ] SQL injection via string concatenation
- [ ] Command injection via shell execution
- [ ] LDAP injection
- [ ] XPath injection
- [ ] NoSQL injection
- [ ] ORM injection

**Code Patterns to Scan:**
```regex
# SQL injection
execute\(["\'].*\+|query\(["\'].*%s|SELECT.*\+.*WHERE
# Command injection
os\.system\(|subprocess.*shell=True|exec\(|eval\(
# NoSQL injection
\$where|\.find\(\{.*user.*\}
```

**Remediation:**
- Use parameterized queries exclusively
- Use ORM with parameter binding
- Validate and sanitize all inputs
- Use allowlist validation

### A04: Insecure Design

**Detection Patterns:**
- [ ] Missing threat modeling
- [ ] Insufficient rate limiting
- [ ] Missing input validation
- [ ] Insecure data flow
- [ ] Missing secure defaults

**Assessment Questions:**
- Are security requirements documented?
- Is threat modeling performed for new features?
- Are secure design patterns used consistently?
- Is defense in depth implemented?

### A05: Security Misconfiguration

**Detection Patterns:**
- [ ] Default credentials in use
- [ ] Unnecessary services enabled
- [ ] Debug mode in production
- [ ] Verbose error messages
- [ ] Missing security headers
- [ ] Overly permissive file permissions

**Code Patterns to Scan:**
```regex
# Debug mode
DEBUG\s*=\s*True|debug:\s*true|NODE_ENV.*development
# Missing security headers
# (check for absence of CSP, X-Frame-Options, etc.)
# Default passwords
password.*admin|password.*default|password.*123
```

**Required Security Headers:**
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-XSS-Protection: 1; mode=block
```

### A06: Vulnerable and Outdated Components

**Detection Patterns:**
- [ ] Known CVEs in dependencies
- [ ] Unmaintained packages
- [ ] Missing security updates
- [ ] Components past EOL

**Scanning Commands:**
```bash
# NPM
npm audit
npx snyk test

# Python
pip-audit
safety check

# Java
mvn dependency-check:check

# Generic
trivy fs .
grype .
```

### A07: Identification and Authentication Failures

**Detection Patterns:**
- [ ] Weak password requirements
- [ ] Missing brute force protection
- [ ] Insecure session management
- [ ] Missing MFA for sensitive operations
- [ ] Credential stuffing vulnerability
- [ ] Session fixation

**Code Patterns to Scan:**
```regex
# Weak password requirements
minlength.*[0-5]|password.*length.*[0-7]
# Missing session timeout
session.*timeout|session.*expires
# Insecure cookie
httponly.*false|secure.*false
```

**Requirements:**
- Minimum 12 character passwords
- Account lockout after 5 failed attempts
- Session timeout (15-30 min idle)
- Secure, HttpOnly, SameSite cookies
- MFA for admin and sensitive operations

### A08: Software and Data Integrity Failures

**Detection Patterns:**
- [ ] Missing code signing
- [ ] Insecure deserialization
- [ ] Missing integrity checks on updates
- [ ] Unverified external data

**Code Patterns to Scan:**
```regex
# Insecure deserialization
pickle\.loads|yaml\.load\(|unserialize\(
# Missing integrity verification
npm install.*--ignore-scripts
```

### A09: Security Logging and Monitoring Failures

**Detection Patterns:**
- [ ] Missing authentication logging
- [ ] Missing authorization logging
- [ ] No alerting on security events
- [ ] Insufficient log retention
- [ ] Logs include sensitive data

**Required Logging:**
- All authentication attempts (success/failure)
- Authorization failures
- Input validation failures
- Security exceptions
- Admin actions

### A10: Server-Side Request Forgery (SSRF)

**Detection Patterns:**
- [ ] User-controlled URLs in requests
- [ ] Missing URL validation
- [ ] Access to internal services
- [ ] Cloud metadata endpoint access

**Code Patterns to Scan:**
```regex
# URL from user input
requests\.get\(.*user|fetch\(.*req\.body|http\.get\(.*input
# Metadata endpoints
169\.254\.169\.254|metadata\.google
```

## Authentication Security Checklist

### Password Management
- [ ] Passwords hashed with bcrypt/Argon2 (cost factor ≥12)
- [ ] Unique salt per password
- [ ] Minimum 12 character passwords
- [ ] Password strength estimation (zxcvbn)
- [ ] Password breach database check
- [ ] No passwords in logs or errors

### Session Management
- [ ] Cryptographically secure session IDs (256+ bits)
- [ ] Session timeout (idle and absolute)
- [ ] Session invalidation on logout
- [ ] Session regeneration on privilege change
- [ ] Secure, HttpOnly, SameSite=Strict cookies

### Multi-Factor Authentication
- [ ] TOTP support (RFC 6238)
- [ ] WebAuthn/FIDO2 support
- [ ] Backup codes with secure storage
- [ ] MFA required for admin accounts
- [ ] MFA enrollment flow security

## Cryptography Standards

### Acceptable Algorithms
| Purpose | Acceptable | Avoid |
|---------|------------|-------|
| Symmetric | AES-256-GCM | DES, 3DES, RC4 |
| Asymmetric | RSA-2048+, ECDSA | RSA-1024 |
| Hashing | SHA-256, SHA-3 | MD5, SHA-1 |
| Password | Argon2, bcrypt | MD5, SHA-* |
| Key Exchange | ECDH, DH-2048+ | DH-1024 |

### Key Management Requirements
- [ ] Keys stored in HSM or secret management
- [ ] Key rotation procedures documented
- [ ] Key escrow for business continuity
- [ ] Separate keys per environment
- [ ] Key access auditing

## API Security Checklist

### Authentication
- [ ] API keys rotated regularly
- [ ] JWT with short expiration (<15 min)
- [ ] Token revocation mechanism
- [ ] OAuth 2.0 with PKCE for SPAs

### Rate Limiting
- [ ] Per-user/API key limits
- [ ] Per-endpoint limits for sensitive operations
- [ ] Graduated response (429 → temporary ban)
- [ ] Rate limit headers returned

### Input Validation
- [ ] JSON schema validation
- [ ] Content-Type enforcement
- [ ] Maximum request size limits
- [ ] File upload restrictions

## Infrastructure Security

### Container Security
- [ ] Minimal base images (Alpine, Distroless)
- [ ] Non-root user
- [ ] Read-only filesystem
- [ ] No privileged containers
- [ ] Resource limits defined
- [ ] Image scanning in CI/CD

### Kubernetes Security
- [ ] Network policies enabled
- [ ] Pod security standards enforced
- [ ] Secrets encrypted at rest
- [ ] RBAC properly configured
- [ ] Service mesh for mTLS

### Cloud Security
- [ ] IAM least privilege
- [ ] VPC network isolation
- [ ] Encryption at rest enabled
- [ ] CloudTrail/audit logging
- [ ] Security group minimal access
