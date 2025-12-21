# DevOps Maturity Reference

## CI/CD Pipeline Requirements

### Build Stage
```yaml
build:
  - Checkout code
  - Install dependencies (cached)
  - Compile/transpile
  - Generate artifacts
  - Store artifacts with versioning
```

**Requirements:**
- [ ] Reproducible builds
- [ ] Dependency caching
- [ ] Build time < 5 minutes
- [ ] Artifact versioning
- [ ] Build logs retained

### Test Stage
```yaml
test:
  - Unit tests
  - Integration tests
  - Security scans (SAST)
  - Dependency scanning
  - Linting
```

**Requirements:**
- [ ] Tests run in parallel
- [ ] Test reports generated
- [ ] Coverage reports generated
- [ ] Security scan results
- [ ] Quality gates enforced

### Deploy Stage
```yaml
deploy:
  - Deploy to staging
  - Run smoke tests
  - Deploy to production (manual gate)
  - Run health checks
  - Enable traffic
```

**Requirements:**
- [ ] Environment parity
- [ ] Deployment verification
- [ ] Automatic rollback on failure
- [ ] Blue-green or canary supported
- [ ] Database migrations handled

## Deployment Strategies

### Blue-Green
```
Pros:
- Zero downtime
- Instant rollback
- Full testing before cutover

Cons:
- 2x infrastructure cost
- Database migration complexity
```

### Canary
```
Pros:
- Gradual rollout
- Limited blast radius
- Real user validation

Cons:
- Complex routing
- Longer deployment time
- Requires traffic splitting
```

### Rolling
```
Pros:
- Resource efficient
- Gradual replacement
- Simple to implement

Cons:
- Mixed versions during deploy
- Slower rollback
- Requires N+1 capacity
```

## Infrastructure as Code

### Terraform Best Practices
- [ ] Remote state storage (S3, GCS)
- [ ] State locking enabled
- [ ] Modules for reusability
- [ ] Environment separation
- [ ] Plan before apply
- [ ] Version constraints

### GitOps Principles
- [ ] Declarative configuration
- [ ] Version controlled
- [ ] Automated sync
- [ ] Pull-based deployment
- [ ] Drift detection

## Container Best Practices

### Dockerfile
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN adduser -D appuser
USER appuser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Checklist:**
- [ ] Multi-stage builds
- [ ] Minimal base image
- [ ] Non-root user
- [ ] Layer caching optimized
- [ ] Security scanning

### Kubernetes Requirements
```yaml
# Essential configurations
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

**Checklist:**
- [ ] Resource limits set
- [ ] Liveness probes configured
- [ ] Readiness probes configured
- [ ] Pod disruption budgets
- [ ] Horizontal pod autoscaling
- [ ] Network policies defined

## Secret Management

### Requirements
- [ ] No secrets in code or config
- [ ] Secrets encrypted at rest
- [ ] Secrets rotated regularly
- [ ] Access audited
- [ ] Environment-specific secrets

### Tools
- HashiCorp Vault
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- Kubernetes Secrets (encrypted)

## Monitoring & Alerting in Production

### Health Endpoints
```
/health/live   - Pod is running (liveness)
/health/ready  - Pod can receive traffic (readiness)
/health/status - Detailed status (internal use)
```

### Runbook Requirements
```markdown
# Alert: High Error Rate

## Description
Error rate exceeded 1% for 5 minutes

## Impact
Users experiencing errors

## Investigation Steps
1. Check recent deployments
2. Review error logs
3. Check dependency health
4. Verify database connectivity

## Remediation
1. If recent deployment, rollback
2. If dependency failure, enable fallback
3. If database issue, check replication

## Escalation
- Page on-call engineer
- Notify engineering manager if unresolved in 30m
```

## Release Management

### Semantic Versioning
```
MAJOR.MINOR.PATCH
1.0.0 → 2.0.0 (breaking changes)
1.0.0 → 1.1.0 (new features)
1.0.0 → 1.0.1 (bug fixes)
```

### Release Checklist
- [ ] All tests passing
- [ ] Security scan clean
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Feature flags configured
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Feature Flags
```
Use cases:
- Gradual rollout
- A/B testing
- Kill switch for new features
- Environment-specific behavior

Best practices:
- Clean up after full rollout
- Default to safe state
- Monitor flag usage
- Document flag purpose
```

## Disaster Recovery

### RPO/RTO Targets
| Tier | RPO | RTO |
|------|-----|-----|
| Tier 1 (Critical) | 0 | 1 hour |
| Tier 2 (Important) | 1 hour | 4 hours |
| Tier 3 (Standard) | 24 hours | 24 hours |

### Backup Strategy
- [ ] Automated backups
- [ ] Off-site backup storage
- [ ] Backup encryption
- [ ] Regular restore testing
- [ ] Point-in-time recovery

### DR Testing
- [ ] Annual DR test
- [ ] Documented procedures
- [ ] Recovery time measured
- [ ] Issues tracked and fixed
