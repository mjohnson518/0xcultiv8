/**
 * Test Utilities
 *
 * Common utilities for testing React components including:
 * - React Query test wrapper
 * - Custom render function
 * - Mock data factories
 * - Async helpers
 */

import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// =============================================================================
// React Query Test Wrapper
// =============================================================================

/**
 * Create a fresh QueryClient for each test
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component with QueryClientProvider
 */
export function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render with all providers
 */
export function renderWithProviders(ui, options = {}) {
  const queryClient = options.queryClient || createTestQueryClient();

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

// Re-export testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Create mock opportunity data
 */
export function createMockOpportunity(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1000),
    protocol_name: 'Aave V3',
    protocol_id: 'aave_v3',
    protocol_type: 'lending',
    blockchain: 'ethereum',
    token_symbol: 'USDC',
    apy: '4.25',
    tvl: '1500000000',
    risk_score: 3,
    is_active: true,
    last_updated: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock investment data
 */
export function createMockInvestment(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1000),
    opportunity_id: 1,
    amount: '10000.00',
    blockchain: 'ethereum',
    transaction_hash: '0x' + '1'.repeat(64),
    expected_apy: '4.25',
    status: 'confirmed',
    invested_at: new Date().toISOString(),
    protocol_name: 'Aave V3',
    current_apy: '4.30',
    protocol_type: 'lending',
    ...overrides,
  };
}

/**
 * Create mock agent config
 */
export function createMockAgentConfig(overrides = {}) {
  return {
    id: 1,
    auto_invest_enabled: false,
    risk_tolerance: 'balanced',
    max_investment_usd: '50000',
    min_apy_threshold: '3.0',
    max_risk_score: 6,
    scan_interval_minutes: 60,
    user_tier: 'community',
    management_fee_percent: '2.0',
    performance_fee_percent: '20.0',
    total_aum: '25000',
    ...overrides,
  };
}

/**
 * Create mock wallet balance
 */
export function createMockWalletBalance(overrides = {}) {
  return {
    USDC: '10,000.00',
    USDT: '5,000.00',
    DAI: '2,500.00',
    ETH: '2.5',
    ...overrides,
  };
}

/**
 * Create mock fund transaction
 */
export function createMockFundTransaction(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1000),
    amount: '5000.00',
    type: 'deposit',
    note: 'Initial funding',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock authorization data
 */
export function createMockAuthorization(overrides = {}) {
  return {
    isAuthorized: false,
    maxPerTransaction: '10000',
    dailyLimit: '50000',
    expiresAt: null,
    transactionHash: null,
    ...overrides,
  };
}

/**
 * Create mock performance data
 */
export function createMockPerformanceData(overrides = {}) {
  return {
    totalInvested: 50000,
    realizedReturn: 2500,
    nominalROI: 5.0,
    realROI: 3.5,
    fxChange: 0.2,
    timeSeries: [
      { date: '2024-01-01', invested: 45000, realized: 1000 },
      { date: '2024-01-15', invested: 48000, realized: 1500 },
      { date: '2024-02-01', invested: 50000, realized: 2500 },
    ],
    ...overrides,
  };
}

// =============================================================================
// Async Helpers
// =============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(condition, { timeout = 5000, interval = 50 } = {}) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

/**
 * Flush promises
 */
export function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for next tick
 */
export function nextTick() {
  return new Promise((resolve) => process.nextTick(resolve));
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert element has specific classes
 */
export function expectClasses(element, classes) {
  classes.forEach((cls) => {
    expect(element).toHaveClass(cls);
  });
}

/**
 * Assert fetch was called with specific URL pattern
 */
export function expectFetchCalled(urlPattern, options = {}) {
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(urlPattern),
    expect.objectContaining(options)
  );
}
