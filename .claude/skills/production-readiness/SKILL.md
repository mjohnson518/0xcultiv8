---
name: production-readiness
description: Enterprise-grade production readiness assessment system for comprehensive codebase evaluation. Use when (1) Evaluating a GitHub repository for production deployment, (2) Conducting pre-launch security and architecture reviews, (3) Assessing technical debt and system reliability, (4) Identifying gaps, vulnerabilities, and incomplete features, (5) Generating actionable remediation plans for engineering teams, (6) Validating scalability, observability, and operational readiness, (7) Reviewing cost optimization and resource efficiency, (8) Auditing compliance with industry standards (SOC2, GDPR, HIPAA, PCI-DSS), (9) Evaluating API contracts and integration stability, (10) Assessing team knowledge transfer and documentation completeness. Performs CTO-level multi-dimensional analysis exceeding top-tier tech company standards.
---

# Production Readiness Assessment System

Enterprise-grade production readiness evaluation framework that exceeds the standards of top-tier technology companies (Google, Meta, Amazon, Microsoft). This skill conducts exhaustive multi-dimensional analysis of any GitHub repository to determine production deployment readiness.

## Overview

Production readiness is not just about working code—it encompasses security posture, operational excellence, scalability architecture, observability infrastructure, compliance requirements, cost efficiency, and team preparedness. This skill evaluates all dimensions systematically.

## Quick Start

```bash
# Clone and analyze a GitHub repository
python scripts/production_readiness.py https://github.com/owner/repo

# Generate comprehensive report
python scripts/production_readiness.py https://github.com/owner/repo --output report.md

# Specific dimension analysis
python scripts/production_readiness.py https://github.com/owner/repo --focus security,performance
```

## Assessment Dimensions

This framework evaluates **15 critical dimensions**:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Security | Critical | Vulnerabilities, auth, encryption, secrets management |
| Architecture | Critical | Design patterns, scalability, modularity |
| Reliability | Critical | Error handling, fault tolerance, recovery |
| Performance | High | Latency, throughput, resource efficiency |
| Observability | High | Logging, metrics, tracing, alerting |
| Testing | High | Coverage, quality, automation |
| DevOps | High | CI/CD, IaC, deployment strategies |
| Data Management | High | Migrations, backups, consistency |
| API Contracts | Medium | Versioning, documentation, stability |
| Documentation | Medium | Code docs, runbooks, architecture diagrams |
| Compliance | Variable | Regulatory requirements (GDPR, SOC2, etc.) |
| Cost Optimization | Medium | Resource efficiency, scaling costs |
| Dependencies | Medium | Currency, vulnerabilities, licensing |
| Configuration | Medium | Secrets, environment management |
| Team Readiness | Medium | Knowledge transfer, on-call procedures |

## Phase 1: Repository Acquisition & Discovery

### Clone Repository
```bash
python scripts/clone_repo.py <github_url> --depth full
```

### Initial Discovery
Execute comprehensive project discovery:
```bash
python scripts/discovery_analyzer.py <project_path>
```

Outputs:
- Technology stack identification (languages, frameworks, databases)
- Dependency graph with version analysis
- Architecture pattern detection
- Configuration file inventory
- Environment detection (dev, staging, prod)
- Codebase statistics (LOC, complexity metrics)

## Phase 2: Security Assessment

### Vulnerability Scanning
```bash
python scripts/security_scanner.py <project_path> --level exhaustive
```

Comprehensive security checks:

**Critical Security Controls:**
- Secrets detection (API keys, credentials, tokens, certificates)
- Authentication implementation (OAuth, JWT, session management)
- Authorization patterns (RBAC, ABAC, policy enforcement)
- Cryptography usage (algorithms, key management, TLS)
- Input validation and sanitization
- Output encoding and XSS prevention
- SQL injection and command injection patterns
- SSRF and path traversal vulnerabilities

**Dependency Security:**
- CVE scanning against NVD database
- License compliance verification
- Supply chain attack vectors
- Transitive dependency analysis

**Infrastructure Security:**
- Container security (base images, privileges)
- Network policies and segmentation
- Secret management infrastructure
- IAM configurations

See `references/security-deep-dive.md` for OWASP Top 10 detailed analysis.

## Phase 3: Architecture Review

### Pattern Analysis
```bash
python scripts/architecture_analyzer.py <project_path>
```

Evaluates:
- **Separation of Concerns**: Layer boundaries, domain isolation
- **Coupling Analysis**: Dependency injection, interface segregation
- **Cohesion Metrics**: Module responsibility, feature clustering
- **Scalability Patterns**: Horizontal scaling readiness, statelessness
- **Resilience Patterns**: Circuit breakers, bulkheads, retry logic
- **Data Flow**: Consistency boundaries, transaction management
- **API Design**: RESTful compliance, GraphQL schema quality
- **Event Architecture**: Pub/sub patterns, event sourcing

### Technical Debt Assessment
```bash
python scripts/debt_analyzer.py <project_path>
```

Identifies:
- Code duplication and dead code
- Complexity hotspots (cyclomatic, cognitive)
- Anti-patterns and code smells
- Outdated patterns and deprecated APIs
- Missing abstractions
- Hardcoded values and magic numbers

## Phase 4: Reliability & Fault Tolerance

### Error Handling Analysis
```bash
python scripts/reliability_analyzer.py <project_path>
```

Checks:
- Exception handling completeness
- Error propagation patterns
- Graceful degradation implementation
- Timeout configurations
- Retry policies with backoff
- Dead letter queues and error recovery
- Health check endpoints
- Liveness and readiness probes

### Chaos Engineering Readiness
Evaluates preparedness for:
- Network partition handling
- Dependency failure scenarios
- Resource exhaustion conditions
- Cascading failure prevention

## Phase 5: Performance Analysis

### Performance Profile
```bash
python scripts/performance_analyzer.py <project_path>
```

Analyzes:
- **Algorithm Complexity**: Big-O analysis of critical paths
- **Database Queries**: N+1 detection, index usage, query optimization
- **Caching Strategy**: Cache invalidation, TTL policies, hit ratios
- **Connection Pooling**: Database, HTTP, Redis connections
- **Memory Management**: Leak detection, garbage collection pressure
- **Concurrency Patterns**: Thread safety, async/await usage
- **Resource Loading**: Lazy loading, code splitting, bundling

### Scalability Assessment
- Horizontal scaling readiness
- Stateless design verification
- Database sharding strategies
- Queue processing capacity
- Rate limiting implementation

## Phase 6: Observability Infrastructure

### Logging Analysis
```bash
python scripts/observability_analyzer.py <project_path>
```

Evaluates:
- Structured logging implementation
- Log level appropriateness
- Correlation ID propagation
- PII/sensitive data masking
- Log retention and rotation
- Centralized logging setup

### Metrics & Monitoring
- Custom metrics implementation
- RED/USE method coverage
- SLI/SLO definitions
- Alerting thresholds
- Dashboard coverage

### Distributed Tracing
- Trace propagation headers
- Span instrumentation
- Service mesh integration
- Trace sampling strategies

## Phase 7: Testing Assessment

### Coverage Analysis
```bash
python scripts/testing_analyzer.py <project_path>
```

Evaluates:
- **Unit Tests**: Coverage %, quality, isolation
- **Integration Tests**: API contracts, database interactions
- **E2E Tests**: Critical user journeys
- **Performance Tests**: Load testing, stress testing
- **Security Tests**: Penetration testing, fuzzing
- **Chaos Tests**: Failure injection scenarios

### Test Quality Metrics
- Test isolation and independence
- Mock/stub appropriateness
- Assertion quality
- Flaky test detection
- Test execution time

## Phase 8: DevOps & Deployment

### CI/CD Pipeline Review
```bash
python scripts/devops_analyzer.py <project_path>
```

Checks:
- Pipeline configuration and stages
- Build reproducibility
- Artifact management
- Environment parity
- Deployment strategies (blue-green, canary, rolling)
- Rollback procedures
- Feature flags implementation
- Database migration safety

### Infrastructure as Code
- Terraform/Pulumi/CloudFormation quality
- State management
- Secret injection
- Environment templating
- Drift detection

## Phase 9: Data Management

### Database Assessment
```bash
python scripts/data_analyzer.py <project_path>
```

Evaluates:
- Schema design and normalization
- Migration safety and reversibility
- Backup and recovery procedures
- Replication configuration
- Connection pool sizing
- Query performance
- Data retention policies

### Data Consistency
- Transaction boundaries
- Eventual consistency handling
- Distributed transaction patterns
- Idempotency implementation

## Phase 10: API & Integration Stability

### API Contract Analysis
```bash
python scripts/api_analyzer.py <project_path>
```

Checks:
- OpenAPI/Swagger specification
- Versioning strategy
- Backward compatibility
- Rate limiting
- Request/response validation
- Error response standardization
- SDK/client library generation

### External Dependencies
- Third-party service reliability
- Fallback implementations
- SLA requirements
- Integration testing coverage

## Phase 11: Documentation Assessment

### Documentation Completeness
```bash
python scripts/docs_analyzer.py <project_path>
```

Evaluates:
- README quality and completeness
- API documentation (generated/manual)
- Architecture decision records (ADRs)
- Runbooks and playbooks
- Incident response procedures
- On-call documentation
- Code comments and docstrings
- Deployment guides

## Phase 12: Compliance Verification

### Regulatory Assessment
```bash
python scripts/compliance_analyzer.py <project_path> --frameworks soc2,gdpr,hipaa,pci
```

Checks per framework. See `references/compliance-frameworks.md` for detailed requirements.

## Phase 13: Cost Optimization

### Resource Efficiency
```bash
python scripts/cost_analyzer.py <project_path>
```

Evaluates:
- Right-sizing recommendations
- Reserved capacity opportunities
- Spot/preemptible usage potential
- Storage tiering optimization
- Network egress patterns
- Cold start optimization (serverless)
- Auto-scaling configurations

## Phase 14: Dependency Health

### Dependency Analysis
```bash
python scripts/dependency_analyzer.py <project_path>
```

Checks:
- Version currency (latest vs. installed)
- Security vulnerabilities (CVE database)
- License compatibility
- Maintenance status (abandoned packages)
- Transitive dependency risks
- Bundle size impact
- SBOM generation

## Phase 15: Team Readiness

### Operational Readiness
```bash
python scripts/team_readiness_analyzer.py <project_path>
```

Evaluates:
- On-call rotation setup
- Incident management procedures
- Knowledge transfer documentation
- Bus factor analysis (code ownership)
- Development workflow documentation
- Onboarding documentation

## Report Generation

### Comprehensive Report
```bash
python scripts/generate_report.py <project_path> --format markdown
```

Report includes:
1. **Executive Summary**: Overall readiness score, critical blockers
2. **Dimension Scores**: 0-100 rating per dimension with justification
3. **Critical Issues**: Immediate blockers requiring resolution
4. **High Priority Items**: Must-fix before production
5. **Medium Priority Items**: Should address within first month
6. **Low Priority Items**: Technical debt backlog
7. **Recommendations**: Specific, actionable remediation steps
8. **Effort Estimates**: Engineering hours per issue category
9. **Risk Assessment**: Impact/likelihood matrix
10. **Roadmap**: Suggested sequence for addressing issues

### Issue Templates
Each finding includes:
```
Issue: [Specific problem description]
Severity: [Critical/High/Medium/Low]
Dimension: [Security/Architecture/etc.]
Location: [File paths and line numbers]
Impact: [Business and technical impact]
Root Cause: [Why this issue exists]
Remediation: [Step-by-step fix instructions]
Validation: [How to verify the fix]
Effort: [Estimated engineering hours]
References: [Relevant standards and best practices]
```

## Scoring Methodology

### Overall Production Readiness Score

```
Score = Σ(Dimension Score × Weight) / Σ(Weights)
```

**Readiness Levels:**
- **90-100**: Production Ready - Deploy with confidence
- **75-89**: Nearly Ready - Minor issues to address
- **50-74**: Significant Work Needed - Major gaps identified
- **25-49**: Not Ready - Critical issues blocking deployment
- **0-24**: Substantial Rebuild Required - Fundamental problems

## Additional Resources

Consult these reference guides for detailed requirements:
- `references/security-deep-dive.md` - OWASP Top 10 and security patterns
- `references/scalability-patterns.md` - Horizontal scaling and resilience
- `references/observability-standards.md` - Logging, metrics, tracing requirements
- `references/compliance-frameworks.md` - SOC2, GDPR, HIPAA, PCI-DSS details
- `references/api-standards.md` - RESTful API best practices
- `references/testing-standards.md` - Coverage requirements and test quality
- `references/devops-maturity.md` - CI/CD and deployment best practices
