/**
 * Vitest Test Setup
 *
 * Global setup for React component testing with:
 * - JSDOM environment configuration
 * - React Testing Library setup
 * - Common mocks (fetch, localStorage, Web3, etc.)
 * - React Query test utilities
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// =============================================================================
// Global Test Lifecycle
// =============================================================================

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =============================================================================
// Mock: window.matchMedia (for responsive components)
// =============================================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// =============================================================================
// Mock: ResizeObserver (for charts and responsive layouts)
// =============================================================================

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// =============================================================================
// Mock: IntersectionObserver (for lazy loading)
// =============================================================================

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// =============================================================================
// Mock: localStorage
// =============================================================================

const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// =============================================================================
// Mock: sessionStorage
// =============================================================================

Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// =============================================================================
// Mock: fetch API
// =============================================================================

export const mockFetch = vi.fn();

global.fetch = mockFetch;

// Helper to set up fetch responses
export function mockFetchResponse(data, options = {}) {
  const { status = 200, ok = true } = options;
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

export function mockFetchError(error) {
  mockFetch.mockRejectedValueOnce(error);
}

// =============================================================================
// Mock: window.ethereum (MetaMask/Web3)
// =============================================================================

export const mockEthereum = {
  isMetaMask: true,
  selectedAddress: null,
  chainId: '0x1', // Ethereum mainnet
  networkVersion: '1',

  request: vi.fn(async ({ method, params }) => {
    switch (method) {
      case 'eth_requestAccounts':
        mockEthereum.selectedAddress = '0x1234567890123456789012345678901234567890';
        return [mockEthereum.selectedAddress];

      case 'eth_accounts':
        return mockEthereum.selectedAddress ? [mockEthereum.selectedAddress] : [];

      case 'eth_chainId':
        return mockEthereum.chainId;

      case 'wallet_switchEthereumChain':
        mockEthereum.chainId = params[0].chainId;
        return null;

      case 'wallet_addEthereumChain':
        return null;

      case 'eth_getBalance':
        return '0x1BC16D674EC80000'; // 2 ETH in hex wei

      case 'eth_blockNumber':
        return '0x1234567';

      case 'personal_sign':
        return '0xsignature';

      default:
        throw new Error(`Unhandled method: ${method}`);
    }
  }),

  on: vi.fn((event, callback) => {
    mockEthereum._listeners = mockEthereum._listeners || {};
    mockEthereum._listeners[event] = callback;
  }),

  removeListener: vi.fn(),

  // Helper to trigger events
  _emit: (event, data) => {
    if (mockEthereum._listeners?.[event]) {
      mockEthereum._listeners[event](data);
    }
  },

  // Reset state for tests
  _reset: () => {
    mockEthereum.selectedAddress = null;
    mockEthereum.chainId = '0x1';
    mockEthereum._listeners = {};
    mockEthereum.request.mockClear();
  },
};

Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true,
});

// =============================================================================
// Mock: console methods (optional - silence during tests)
// =============================================================================

// Uncomment to silence console during tests
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// =============================================================================
// Mock: crypto.randomUUID
// =============================================================================

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// =============================================================================
// Mock: scrollTo
// =============================================================================

window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// =============================================================================
// Mock: URL.createObjectURL
// =============================================================================

URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();
