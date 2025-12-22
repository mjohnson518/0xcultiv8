# Cultiv8 Load Testing Infrastructure

This directory contains load testing configurations and scripts for the Cultiv8 DeFi platform.

## Overview

We support two load testing frameworks:
- **k6** - Recommended for developer testing and CI/CD integration
- **Artillery** - Alternative with YAML configuration

## Quick Start

### Prerequisites

```bash
# Install k6 (macOS)
brew install k6

# Install Artillery
npm install -g artillery
```

### Running Tests

#### k6 Tests

```bash
# Smoke test (verify system works)
k6 run --env SCENARIO=smoke load-testing/k6-config.js

# Load test (typical traffic)
k6 run --env SCENARIO=load load-testing/k6-config.js

# Stress test (beyond expected load)
k6 run --env SCENARIO=stress load-testing/k6-config.js

# Spike test (sudden traffic burst)
k6 run --env SCENARIO=spike load-testing/k6-config.js

# Against staging
k6 run --env TARGET_URL=https://staging.cultiv8.xyz load-testing/k6-config.js
```

#### Artillery Tests

```bash
# Standard load test
artillery run load-testing/artillery-config.yml

# Generate HTML report
artillery run --output results.json load-testing/artillery-config.yml
artillery report results.json
```

## Test Scenarios

### 1. Smoke Test
**Purpose:** Verify the system is functional
- 1 VU for 1 minute
- Basic health checks
- Quick sanity verification

### 2. Load Test
**Purpose:** Simulate typical production traffic
- Ramp from 0 → 50 → 100 users
- Sustained load for 5 minutes each stage
- Tests normal operating conditions

### 3. Stress Test
**Purpose:** Find system breaking points
- Ramp up to 300 concurrent users
- Identifies performance degradation
- Helps establish capacity limits

### 4. Spike Test
**Purpose:** Test sudden traffic bursts
- Normal load → 500 users spike → Normal
- Tests auto-scaling and recovery
- Identifies rate limiting behavior

### 5. Soak Test
**Purpose:** Long-term stability
- 50 VUs for 1 hour
- Detects memory leaks
- Tests sustained performance

## Performance Thresholds

| Metric | Target | Critical |
|--------|--------|----------|
| P95 Response Time | < 500ms | < 1500ms |
| P99 Response Time | < 1500ms | < 3000ms |
| Error Rate | < 1% | < 5% |
| Throughput | > 100 req/s | > 50 req/s |

## API Endpoints Tested

| Endpoint | Method | Weight |
|----------|--------|--------|
| `/api/health` | GET | High |
| `/api/opportunities` | GET | High |
| `/api/investments` | GET | Medium |
| `/api/agent-config` | GET/PUT | Medium |
| `/api/performance` | GET | Medium |
| `/api/metrics` | GET | Low |

## Environment Configuration

Set these environment variables for different targets:

```bash
# Local development
export TARGET_URL=http://localhost:3000

# Staging
export TARGET_URL=https://staging.cultiv8.xyz

# Production (use with caution!)
export TARGET_URL=https://cultiv8.xyz
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Load Test
        run: k6 run --env TARGET_URL=${{ vars.STAGING_URL }} load-testing/k6-config.js
        env:
          K6_OUT: json=results.json

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: results.json
```

## Capacity Planning

Based on load test results, estimate capacity:

| Metric | Current | Target |
|--------|---------|--------|
| Max concurrent users | TBD | 1000 |
| Requests per second | TBD | 500 |
| Average response time | TBD | < 200ms |
| 95th percentile | TBD | < 500ms |

## Interpreting Results

### k6 Output Metrics

```
✓ http_req_duration..........: avg=245ms min=12ms med=180ms max=2.5s p(90)=450ms p(95)=650ms
✓ http_req_failed............: 0.15%  ✓ 15     ✗ 9985
✓ http_reqs..................: 10000  166.67/s
✓ iteration_duration.........: avg=1.2s  min=500ms med=1s   max=5s  p(90)=2s   p(95)=3s
```

Key metrics:
- `http_req_duration`: Response time distribution
- `http_req_failed`: Failed request rate
- `http_reqs`: Total requests and throughput

### Failure Indicators

1. **High P95/P99**: Backend overloaded
2. **Increasing error rate**: Resource exhaustion
3. **Timeout errors**: Connection pool issues
4. **429 responses**: Rate limiting active

## Troubleshooting

### Common Issues

**"Target not reachable"**
- Check TARGET_URL is correct
- Verify network connectivity
- Check firewall rules

**"Rate limited (429)"**
- Expected behavior under high load
- Verify rate limit configuration
- Consider increasing limits for testing

**"High error rate"**
- Check server logs
- Verify database connections
- Check memory/CPU usage

## Best Practices

1. **Never run against production** without approval
2. **Start with smoke tests** before full load tests
3. **Monitor infrastructure** during tests
4. **Run tests during off-peak hours**
5. **Document baseline metrics** before changes
6. **Automate in CI/CD** for regression detection

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-best-practices/)

---

Last Updated: December 2024
