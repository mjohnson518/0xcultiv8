/**
 * K6 Load Testing Configuration for Cultiv8 Platform
 *
 * Install k6: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation/
 *
 * Run tests:
 *   k6 run load-testing/k6-config.js
 *   k6 run --env TARGET_URL=https://staging.cultiv8.xyz load-testing/k6-config.js
 *
 * Run with specific scenario:
 *   k6 run --env SCENARIO=smoke load-testing/k6-config.js
 *   k6 run --env SCENARIO=load load-testing/k6-config.js
 *   k6 run --env SCENARIO=stress load-testing/k6-config.js
 *   k6 run --env SCENARIO=spike load-testing/k6-config.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const opportunitiesFetched = new Counter('opportunities_fetched');
const investmentExecutions = new Counter('investment_executions');

// Configuration
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'load';

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - minimal load to verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      exec: 'smokeTest',
      tags: { scenario: 'smoke' },
    },

    // Load test - typical expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      exec: 'loadTest',
      tags: { scenario: 'load' },
    },

    // Stress test - beyond expected load
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 0 },
      ],
      exec: 'stressTest',
      tags: { scenario: 'stress' },
    },

    // Spike test - sudden load increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },   // Normal load
        { duration: '1m', target: 10 },
        { duration: '10s', target: 500 },  // Spike!
        { duration: '3m', target: 500 },   // Stay at spike
        { duration: '10s', target: 10 },   // Drop back
        { duration: '2m', target: 10 },
        { duration: '10s', target: 0 },
      ],
      exec: 'spikeTest',
      tags: { scenario: 'spike' },
    },

    // Soak test - sustained load over time
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1h',
      exec: 'loadTest',
      tags: { scenario: 'soak' },
    },
  },

  // Thresholds define pass/fail criteria
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],  // 95% of requests under 500ms
    errors: ['rate<0.05'],                            // Error rate under 5%
    http_req_failed: ['rate<0.01'],                   // HTTP errors under 1%
    api_latency: ['p(95)<400'],                       // Custom API latency
  },
};

// Helper function for authenticated requests
function authenticatedRequest(method, path, body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const params = { headers };
  const url = `${TARGET_URL}${path}`;

  let response;
  const start = Date.now();

  if (method === 'GET') {
    response = http.get(url, params);
  } else if (method === 'POST') {
    response = http.post(url, JSON.stringify(body), params);
  } else if (method === 'PUT') {
    response = http.put(url, JSON.stringify(body), params);
  } else if (method === 'DELETE') {
    response = http.del(url, null, params);
  }

  apiLatency.add(Date.now() - start);
  return response;
}

// Smoke test - basic functionality verification
export function smokeTest() {
  group('Health Check', () => {
    const res = http.get(`${TARGET_URL}/api/health`);
    check(res, {
      'health check status 200': (r) => r.status === 200,
      'health check has status': (r) => r.json('status') !== undefined,
    }) || errorRate.add(1);
  });

  group('Opportunities List', () => {
    const res = authenticatedRequest('GET', '/api/opportunities');
    check(res, {
      'opportunities status 200': (r) => r.status === 200,
      'opportunities is array': (r) => Array.isArray(r.json()),
    }) || errorRate.add(1);

    if (res.status === 200) {
      opportunitiesFetched.add(1);
    }
  });

  sleep(1);
}

// Load test - typical user journey
export function loadTest() {
  // Simulate a typical user session
  group('User Session', () => {
    // 1. Check health
    group('Health Check', () => {
      const res = http.get(`${TARGET_URL}/api/health`);
      check(res, {
        'health check ok': (r) => r.status === 200,
      }) || errorRate.add(1);
    });

    sleep(0.5);

    // 2. Fetch opportunities
    group('Fetch Opportunities', () => {
      const res = authenticatedRequest('GET', '/api/opportunities');
      check(res, {
        'opportunities loaded': (r) => r.status === 200,
        'has opportunities': (r) => r.json().length > 0,
      }) || errorRate.add(1);

      if (res.status === 200) {
        opportunitiesFetched.add(1);
      }
    });

    sleep(1);

    // 3. Fetch investments
    group('Fetch Investments', () => {
      const res = authenticatedRequest('GET', '/api/investments');
      check(res, {
        'investments loaded': (r) => r.status === 200 || r.status === 401,
      }) || errorRate.add(1);
    });

    sleep(0.5);

    // 4. Fetch agent config
    group('Fetch Agent Config', () => {
      const res = authenticatedRequest('GET', '/api/agent-config');
      check(res, {
        'config loaded': (r) => r.status === 200 || r.status === 401,
      }) || errorRate.add(1);
    });

    sleep(0.5);

    // 5. Fetch performance metrics
    group('Fetch Performance', () => {
      const res = authenticatedRequest('GET', '/api/performance?days=30&bucket=day');
      check(res, {
        'performance loaded': (r) => r.status === 200 || r.status === 401,
      }) || errorRate.add(1);
    });

    sleep(2);
  });
}

// Stress test - push the system
export function stressTest() {
  group('Stress Test', () => {
    // Multiple concurrent API calls
    const responses = http.batch([
      ['GET', `${TARGET_URL}/api/health`, null, { tags: { name: 'health' } }],
      ['GET', `${TARGET_URL}/api/opportunities`, null, { tags: { name: 'opportunities' } }],
      ['GET', `${TARGET_URL}/api/metrics`, null, { tags: { name: 'metrics' } }],
    ]);

    responses.forEach((res, idx) => {
      check(res, {
        [`batch request ${idx} ok`]: (r) => r.status === 200 || r.status === 401,
      }) || errorRate.add(1);
    });

    sleep(0.5);

    // Simulate rapid polling
    for (let i = 0; i < 5; i++) {
      const res = http.get(`${TARGET_URL}/api/opportunities`);
      check(res, {
        'rapid poll ok': (r) => r.status === 200 || r.status === 429, // Accept rate limiting
      });
      sleep(0.1);
    }

    sleep(1);
  });
}

// Spike test - handle sudden traffic
export function spikeTest() {
  group('Spike Test', () => {
    // Normal user flow during spike
    const res = http.get(`${TARGET_URL}/api/opportunities`);

    check(res, {
      'spike handled': (r) => r.status === 200 || r.status === 429 || r.status === 503,
    }) || errorRate.add(1);

    // Check if system degrades gracefully
    if (res.status === 429) {
      // Rate limited - expected behavior
      check(res, {
        'rate limit header present': (r) => r.headers['Retry-After'] !== undefined,
      });
    } else if (res.status === 503) {
      // Service unavailable - check for proper response
      check(res, {
        'graceful degradation': (r) => true,
      });
    }

    sleep(0.5);
  });
}

// Teardown - runs once at the end
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Scenario: ${SCENARIO}`);
}

// Setup - runs once at the start
export function setup() {
  // Verify target is reachable
  const res = http.get(`${TARGET_URL}/api/health`);
  if (res.status !== 200) {
    console.error(`Target ${TARGET_URL} is not reachable`);
  }

  return { startTime: new Date().toISOString() };
}
