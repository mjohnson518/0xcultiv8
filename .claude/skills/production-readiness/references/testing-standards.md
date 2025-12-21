# Testing Standards Reference

## Coverage Requirements

### Minimum Coverage Targets

| Test Type | Minimum | Target | Critical Paths |
|-----------|---------|--------|----------------|
| Unit Tests | 70% | 85% | 95% |
| Integration | 50% | 70% | 90% |
| E2E | Critical paths | All user journeys | 100% |

### Coverage Quality Metrics
- **Line Coverage**: % of code lines executed
- **Branch Coverage**: % of decision branches taken
- **Function Coverage**: % of functions called
- **Mutation Coverage**: % of mutations detected

## Test Types

### Unit Tests
```
Characteristics:
- Test single function/class in isolation
- Mock external dependencies
- Fast execution (<100ms per test)
- Deterministic results

Focus Areas:
- Business logic
- Utility functions
- Data transformations
- Edge cases
- Error handling
```

### Integration Tests
```
Characteristics:
- Test component interactions
- Real dependencies where practical
- Database tests with test containers
- API contract verification

Focus Areas:
- API endpoints
- Database operations
- Service interactions
- Message queue handling
```

### End-to-End Tests
```
Characteristics:
- Test complete user journeys
- Real browser/client
- Production-like environment
- Slower execution acceptable

Focus Areas:
- Critical user flows
- Authentication journeys
- Payment flows
- Data integrity flows
```

### Performance Tests

**Load Testing:**
- Sustained load at expected levels
- Duration: 10-30 minutes
- Validate response times under load

**Stress Testing:**
- Load beyond capacity
- Find breaking points
- Validate graceful degradation

**Spike Testing:**
- Sudden traffic increases
- Validate auto-scaling
- Check recovery behavior

**Soak Testing:**
- Extended duration (hours/days)
- Memory leak detection
- Resource exhaustion

### Security Tests

**SAST (Static Application Security Testing):**
- Run in CI/CD pipeline
- Check for code vulnerabilities
- Tools: SonarQube, Checkmarx, Semgrep

**DAST (Dynamic Application Security Testing):**
- Run against deployed application
- Find runtime vulnerabilities
- Tools: OWASP ZAP, Burp Suite

**Dependency Scanning:**
- Check for vulnerable packages
- Run on every build
- Tools: Snyk, npm audit, pip-audit

## Test Quality Metrics

### Test Isolation
```
Rules:
- Tests should not depend on execution order
- Each test should clean up after itself
- No shared mutable state
- Use fresh fixtures per test
```

### Test Speed
```
Targets:
- Unit tests: <100ms each
- Integration tests: <5s each
- E2E tests: <60s each
- Full suite: <10 minutes
```

### Flaky Test Policy
```
Definition: Test that fails intermittently without code changes

Actions:
1. Quarantine immediately
2. Fix within 48 hours
3. If not fixable, remove and create ticket
4. Track flakiness rate (<1% acceptable)
```

## Testing Patterns

### Arrange-Act-Assert
```python
def test_user_creation():
    # Arrange
    user_data = {"name": "John", "email": "john@example.com"}
    
    # Act
    user = create_user(user_data)
    
    # Assert
    assert user.name == "John"
    assert user.email == "john@example.com"
```

### Given-When-Then (BDD)
```gherkin
Given a user with email "john@example.com"
When the user attempts to login with correct password
Then the user should be authenticated
And a session token should be generated
```

### Test Doubles

| Type | Purpose | Example Use |
|------|---------|-------------|
| Stub | Return canned data | External API response |
| Mock | Verify interactions | Email sent verification |
| Fake | Simplified implementation | In-memory database |
| Spy | Record calls | Analytics tracking |

## CI/CD Integration

### Test Stages
```yaml
stages:
  - lint
  - unit-tests
  - integration-tests
  - security-scan
  - e2e-tests (merge to main only)
  - performance-tests (nightly)
```

### Quality Gates
```yaml
gates:
  - unit_coverage: >= 70%
  - no_critical_vulnerabilities
  - no_test_failures
  - lint_clean
```

### Test Parallelization
```
Strategies:
- Split by test file
- Split by test directory
- Split by test duration
- Use test sharding
```

## Testing Checklist

### Unit Tests
- [ ] Business logic fully covered
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Mocks properly configured
- [ ] Tests are independent

### Integration Tests
- [ ] API contracts verified
- [ ] Database operations tested
- [ ] External services mocked
- [ ] Error handling tested
- [ ] Authentication flows tested

### E2E Tests
- [ ] Critical user journeys covered
- [ ] Cross-browser testing (if applicable)
- [ ] Mobile responsiveness tested
- [ ] Accessibility tested
- [ ] Error recovery tested

### Performance Tests
- [ ] Baseline established
- [ ] Load tests pass SLA
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Caching effective

### Security Tests
- [ ] SAST passing
- [ ] No critical CVEs
- [ ] OWASP Top 10 verified
- [ ] Authentication tested
- [ ] Authorization tested
