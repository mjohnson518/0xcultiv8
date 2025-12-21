# Observability Standards Reference

Comprehensive observability requirements covering logging, metrics, tracing, and alerting.

## The Three Pillars of Observability

### 1. Logging

Logs provide discrete events and debugging information for understanding system behavior.

### 2. Metrics

Metrics provide aggregated numerical data for understanding system health and performance.

### 3. Tracing

Traces provide request flow information across distributed systems.

## Logging Standards

### Structured Logging Requirements

**Log Format (JSON recommended):**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "service": "user-service",
  "trace_id": "abc123def456",
  "span_id": "xyz789",
  "user_id": "masked-user-id",
  "message": "User authentication successful",
  "event_type": "auth.success",
  "metadata": {
    "ip": "192.168.1.x",
    "user_agent": "Mozilla/5.0..."
  }
}
```

**Required Fields:**
- [ ] `timestamp` - ISO 8601 format with timezone
- [ ] `level` - DEBUG, INFO, WARN, ERROR, FATAL
- [ ] `service` - Service name identifier
- [ ] `message` - Human-readable description
- [ ] `trace_id` - Correlation ID for distributed tracing
- [ ] `event_type` - Machine-parseable event category

### Log Levels Usage

| Level | Use Case | Example |
|-------|----------|---------|
| DEBUG | Development debugging | Variable values, function entry/exit |
| INFO | Normal operations | Request handled, job completed |
| WARN | Recoverable issues | Retry attempt, deprecated API use |
| ERROR | Operation failures | API call failed, validation error |
| FATAL | System failures | Cannot start, unrecoverable state |

### Mandatory Logging Events

**Authentication:**
- [ ] Login attempts (success/failure)
- [ ] Logout events
- [ ] Password changes
- [ ] MFA events
- [ ] Session creation/destruction

**Authorization:**
- [ ] Access denied events
- [ ] Privilege escalation
- [ ] Resource access (sensitive resources)

**System Events:**
- [ ] Service startup/shutdown
- [ ] Configuration changes
- [ ] Health check results
- [ ] Resource exhaustion warnings

**Business Events:**
- [ ] Transaction completions
- [ ] Payment processing
- [ ] Critical business operations

### PII Handling in Logs

**Must Mask/Exclude:**
- Passwords and credentials
- Full credit card numbers
- Social Security numbers
- API keys and tokens
- Personal health information
- Email addresses (partial masking acceptable)

**Masking Example:**
```json
{
  "user_email": "j***@example.com",
  "card_last_four": "4242",
  "ip_address": "192.168.x.x"
}
```

### Log Retention Requirements

| Log Type | Minimum Retention | Maximum Retention |
|----------|------------------|-------------------|
| Security logs | 1 year | 7 years |
| Application logs | 30 days | 90 days |
| Debug logs | 7 days | 30 days |
| Audit logs | 7 years | Indefinite |

## Metrics Standards

### RED Method (Request-focused)

**Rate** - Requests per second
```
http_requests_total{service="api", method="GET", endpoint="/users"}
```

**Errors** - Errors per second
```
http_requests_total{service="api", status="5xx"}
```

**Duration** - Request latency distribution
```
http_request_duration_seconds{service="api", quantile="0.99"}
```

### USE Method (Resource-focused)

**Utilization** - % of time resource is busy
```
node_cpu_utilization_percent
container_memory_utilization_percent
```

**Saturation** - Work resource cannot service
```
node_cpu_queue_length
container_memory_swap_usage_bytes
```

**Errors** - Error count
```
node_disk_errors_total
network_packet_errors_total
```

### Required Application Metrics

**HTTP Endpoints:**
```prometheus
# Request count by endpoint, method, status
http_requests_total{endpoint, method, status}

# Request duration histogram
http_request_duration_seconds{endpoint, method}

# Active connections
http_connections_active

# Request size
http_request_size_bytes{endpoint}

# Response size
http_response_size_bytes{endpoint}
```

**Database:**
```prometheus
# Query count by operation
db_queries_total{operation, table}

# Query duration
db_query_duration_seconds{operation}

# Connection pool stats
db_pool_connections_active
db_pool_connections_idle
db_pool_connections_waiting

# Error rate
db_errors_total{error_type}
```

**Cache:**
```prometheus
# Hit/miss ratio
cache_hits_total{cache_name}
cache_misses_total{cache_name}

# Cache size
cache_entries_count{cache_name}
cache_size_bytes{cache_name}

# Evictions
cache_evictions_total{cache_name}
```

**Queue/Workers:**
```prometheus
# Queue depth
queue_messages_count{queue_name}

# Processing rate
queue_messages_processed_total{queue_name}

# Processing time
queue_message_processing_seconds{queue_name}

# Failed messages
queue_messages_failed_total{queue_name}
```

### SLI/SLO Definitions

**Availability SLI:**
```
availability = successful_requests / total_requests
```

**Latency SLI:**
```
latency_sli = requests_under_threshold / total_requests
```

**Example SLOs:**

| SLI | SLO | Window |
|-----|-----|--------|
| Availability | 99.9% | 30 days |
| P50 Latency | < 100ms | 30 days |
| P99 Latency | < 500ms | 30 days |
| Error Rate | < 0.1% | 30 days |

### Dashboard Requirements

**Service Overview Dashboard:**
- [ ] Request rate (requests/sec)
- [ ] Error rate (errors/sec, error %)
- [ ] Latency percentiles (p50, p95, p99)
- [ ] Saturation (CPU, memory, connections)
- [ ] Traffic breakdown by endpoint

**Infrastructure Dashboard:**
- [ ] Node CPU/memory/disk utilization
- [ ] Network I/O
- [ ] Container stats
- [ ] Pod/service health

**Business Dashboard:**
- [ ] Active users
- [ ] Transaction volume
- [ ] Revenue metrics
- [ ] Conversion rates

## Distributed Tracing Standards

### Trace Context Propagation

**W3C Trace Context Headers:**
```
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
tracestate: vendor1=value1,vendor2=value2
```

**Required Span Attributes:**

| Attribute | Description | Example |
|-----------|-------------|---------|
| service.name | Service identifier | user-service |
| service.version | Service version | 1.2.3 |
| deployment.environment | Environment | production |
| http.method | HTTP method | GET |
| http.url | Full URL | https://api.example.com/users |
| http.status_code | Response code | 200 |
| db.system | Database type | postgresql |
| db.statement | Query (sanitized) | SELECT * FROM users WHERE id = ? |

### Instrumentation Requirements

**HTTP Server:**
```
[Span: HTTP GET /api/users]
├── service.name: user-api
├── http.method: GET
├── http.url: /api/users
├── http.status_code: 200
├── duration: 45ms
└── events:
    ├── request.received
    └── response.sent
```

**Database Queries:**
```
[Span: PostgreSQL Query]
├── db.system: postgresql
├── db.name: users_db
├── db.statement: SELECT * FROM users WHERE id = $1
├── db.operation: SELECT
└── duration: 12ms
```

**External Service Calls:**
```
[Span: HTTP GET external-api.com]
├── http.method: GET
├── http.url: https://external-api.com/resource
├── http.status_code: 200
├── peer.service: external-api
└── duration: 150ms
```

### Trace Sampling Strategies

**Head-based Sampling:**
- Rate-based: Sample X% of all traces
- Priority-based: Always trace specific operations

**Tail-based Sampling:**
- Error-based: Always sample failed requests
- Latency-based: Sample slow requests
- Feature-based: Sample specific features

**Recommended Configuration:**
```yaml
sampling:
  default_rate: 0.1  # 10% of normal traffic
  error_rate: 1.0    # 100% of errors
  slow_threshold_ms: 1000
  slow_rate: 1.0     # 100% of slow requests
  always_sample:
    - /api/payments
    - /api/auth
```

## Alerting Standards

### Alert Severity Levels

| Severity | Response Time | Notification | Example |
|----------|--------------|--------------|---------|
| P1 - Critical | Immediate | PagerDuty + Slack | Service down |
| P2 - High | 15 minutes | PagerDuty + Slack | High error rate |
| P3 - Medium | 1 hour | Slack | Elevated latency |
| P4 - Low | Next business day | Email | Warning threshold |

### Alert Best Practices

**Symptom-based, not cause-based:**
```yaml
# Good: Alert on symptom
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  
# Bad: Alert on potential cause
- alert: DatabaseCPUHigh
  expr: db_cpu_percent > 80
```

**Include runbook links:**
```yaml
annotations:
  summary: "High error rate on {{ $labels.service }}"
  runbook_url: "https://runbooks.example.com/high-error-rate"
  dashboard: "https://grafana.example.com/d/service-overview"
```

### Required Alerts

**Availability:**
```yaml
- alert: ServiceDown
  expr: up == 0
  for: 1m
  severity: critical

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 5m
  severity: high
```

**Latency:**
```yaml
- alert: HighP99Latency
  expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  severity: medium

- alert: HighP50Latency
  expr: histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 10m
  severity: low
```

**Saturation:**
```yaml
- alert: HighCPUUsage
  expr: avg(rate(container_cpu_usage_seconds_total[5m])) > 0.9
  for: 10m
  severity: high

- alert: HighMemoryUsage
  expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
  for: 5m
  severity: high
```

**Business:**
```yaml
- alert: LowOrderVolume
  expr: rate(orders_total[1h]) < 10
  for: 30m
  severity: medium

- alert: PaymentFailureSpike
  expr: rate(payments_failed_total[5m]) > rate(payments_total[5m]) * 0.1
  for: 5m
  severity: high
```

## Tool Recommendations

### Logging
- **OpenTelemetry** - Vendor-neutral instrumentation
- **Elasticsearch/OpenSearch** - Log storage and search
- **Loki** - Prometheus-native log aggregation

### Metrics
- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **DataDog/New Relic** - Full-stack commercial solutions

### Tracing
- **Jaeger** - Open-source distributed tracing
- **Zipkin** - Distributed tracing system
- **OpenTelemetry Collector** - Unified collection

### Alerting
- **Prometheus Alertmanager** - Alert routing and deduplication
- **PagerDuty** - Incident management
- **OpsGenie** - On-call scheduling and alerting
