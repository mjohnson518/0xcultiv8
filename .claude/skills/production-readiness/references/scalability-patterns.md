# Scalability Patterns Reference

## Horizontal Scaling Readiness

### Stateless Design Checklist
- [ ] No local file storage for user data
- [ ] Session state externalized (Redis, database)
- [ ] No in-memory caches for shared data
- [ ] Configuration via environment variables
- [ ] No sticky sessions required

### Database Scaling Patterns

**Read Replicas:**
- Route read queries to replicas
- Accept eventual consistency (typically <1s lag)
- Monitor replication lag

**Connection Pooling:**
- Pool size = (core_count * 2) + disk_count
- Use PgBouncer, ProxySQL, or application-level pools
- Monitor pool saturation

**Sharding Strategies:**
| Strategy | Use Case | Complexity |
|----------|----------|------------|
| Range-based | Time-series data | Low |
| Hash-based | Uniform distribution | Medium |
| Geography-based | Regional compliance | High |
| Custom | Business requirements | Very High |

### Caching Patterns

**Cache-Aside:**
```
1. Check cache
2. If miss, load from DB
3. Store in cache
4. Return data
```

**Write-Through:**
```
1. Write to cache
2. Cache writes to DB
3. Return success
```

**TTL Guidelines:**
| Data Type | TTL | Strategy |
|-----------|-----|----------|
| Static config | 24h | Cache-aside |
| User profiles | 5m | Cache-aside with invalidation |
| Session data | 30m | Write-through |
| Computed data | 1h | Background refresh |

## Resilience Patterns

### Circuit Breaker
```
States: CLOSED → OPEN → HALF_OPEN → CLOSED

Configuration:
- failure_threshold: 5
- success_threshold: 2  
- timeout: 30s
```

### Retry with Exponential Backoff
```
delay = min(initial_delay * 2^attempt, max_delay)
jitter = random(0, delay * 0.1)
wait = delay + jitter

Configuration:
- max_attempts: 3
- initial_delay: 100ms
- max_delay: 10s
```

### Bulkhead Pattern
```
Isolate failures:
- Separate thread pools per dependency
- Connection pool limits
- Resource quotas per tenant
```

### Rate Limiting
```
Algorithms:
- Token Bucket: Burst-friendly
- Leaky Bucket: Smooth rate
- Sliding Window: Accurate counting

Implementation:
- Per-user: 100 req/min
- Per-IP: 1000 req/min
- Per-endpoint: Based on cost
```

## Load Balancing

### Algorithms
| Algorithm | Use Case |
|-----------|----------|
| Round Robin | Homogeneous servers |
| Least Connections | Variable request duration |
| IP Hash | Session affinity |
| Weighted | Heterogeneous capacity |

### Health Checks
```yaml
healthCheck:
  path: /health
  interval: 5s
  timeout: 2s
  unhealthyThreshold: 3
  healthyThreshold: 2
```

## Auto-Scaling

### Metrics-Based Scaling
```yaml
scaling:
  min_replicas: 2
  max_replicas: 20
  metrics:
    - type: cpu
      target: 70%
    - type: memory
      target: 80%
    - type: custom
      name: queue_depth
      target: 100
```

### Predictive Scaling
- Analyze historical patterns
- Pre-scale for known events
- Machine learning for demand prediction

## Queue-Based Architecture

### Queue Design
- [ ] Dead letter queue for failures
- [ ] Message TTL configured
- [ ] Idempotent consumers
- [ ] Visibility timeout > processing time
- [ ] FIFO where ordering matters

### Backpressure Handling
```
1. Monitor queue depth
2. Scale consumers when depth > threshold
3. Reject/defer new messages at capacity
4. Alert when backlog exceeds SLA
```

## Performance Optimization

### Database
- Proper indexing (explain analyze queries)
- Query optimization
- Connection pooling
- Read/write splitting

### Application
- Async/await for I/O operations
- Batch operations where possible
- Lazy loading
- Response compression

### Network
- CDN for static assets
- HTTP/2 or HTTP/3
- Connection keep-alive
- Regional deployment
