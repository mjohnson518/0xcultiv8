/**
 * RetroDashboard Component Tests
 *
 * Tests for the Dashboard page component including:
 * - Metrics display (TVL, APY, positions, risk)
 * - Agent status and terminal output
 * - Active positions table
 * - Top opportunities table
 * - Action buttons (scan, navigate)
 * - Wallet connection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetroDashboard } from '@/components/Cultiv8Agent/RetroDashboard';

// Mock react-router
const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RetroDashboard', () => {
  const mockInvestments = [
    {
      id: 1,
      protocol_name: 'Aave V3',
      blockchain: 'ethereum',
      amount: 5000,
      expected_apy: 8.5,
      risk_score: 3,
      status: 'confirmed',
    },
    {
      id: 2,
      protocol_name: 'Compound V3',
      blockchain: 'ethereum',
      amount: 3000,
      expected_apy: 7.2,
      risk_score: 4,
      status: 'confirmed',
    },
    {
      id: 3,
      protocol_name: 'Morpho Blue',
      blockchain: 'base',
      amount: 2000,
      expected_apy: 12.5,
      risk_score: 6,
      status: 'pending',
    },
  ];

  const mockOpportunities = [
    {
      id: 1,
      protocol_name: 'Aave V3',
      protocol: 'aave',
      apy: 8.5,
      tvl: 5000000000,
      risk_score: 3,
    },
    {
      id: 2,
      protocol_name: 'Compound V3',
      protocol: 'compound',
      apy: 7.2,
      tvl: 3000000000,
      risk_score: 4,
    },
    {
      id: 3,
      protocol_name: 'Morpho Blue',
      protocol: 'morpho',
      apy: 12.5,
      tvl: 500000000,
      risk_score: 6,
    },
  ];

  const defaultProps = {
    config: {},
    opportunities: mockOpportunities,
    investments: mockInvestments,
    walletAddress: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    onConnect: vi.fn(),
    onRunScan: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Rendering', () => {
    it('renders the dashboard page', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('0xCULTIV8')).toBeInTheDocument();
    });

    it('renders ASCII logo banner', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/AUTONOMOUS DEFI YIELD AGENT/)).toBeInTheDocument();
    });

    it('renders navigation links', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('Opportunities')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders agent status section', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/STANDBY|SCANNING|EXECUTING/)).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    it('displays total value locked', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('Total Value Locked')).toBeInTheDocument();
      // 5000 + 3000 + 2000 = 10000
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    it('displays average APY', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('Average APY')).toBeInTheDocument();
      // (8.5 + 7.2 + 12.5) / 3 = 9.4
      expect(screen.getByText('9.40%')).toBeInTheDocument();
    });

    it('displays active positions count', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('Active Positions')).toBeInTheDocument();
      // All 3 are active (confirmed or pending)
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays risk score', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('Risk Score')).toBeInTheDocument();
      // (3 + 4 + 6) / 3 = 4.3
      expect(screen.getByText('4.3/10')).toBeInTheDocument();
    });

    it('shows zero values when no investments', () => {
      render(<RetroDashboard {...defaultProps} investments={[]} />);

      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText('0.00%')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Active Positions Table', () => {
    it('renders active positions section', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('active_positions.log')).toBeInTheDocument();
    });

    it('displays position count in status', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('3 ACTIVE')).toBeInTheDocument();
    });

    it('displays investment rows', () => {
      render(<RetroDashboard {...defaultProps} />);

      // Protocol names appear in active positions table (may also appear in opportunities)
      const aaveElements = screen.getAllByText('Aave V3');
      expect(aaveElements.length).toBeGreaterThanOrEqual(1);
      const compoundElements = screen.getAllByText('Compound V3');
      expect(compoundElements.length).toBeGreaterThanOrEqual(1);
      const morphoElements = screen.getAllByText('Morpho Blue');
      expect(morphoElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows formatted amounts', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('$3,000')).toBeInTheDocument();
      expect(screen.getByText('$2,000')).toBeInTheDocument();
    });

    it('shows empty message when no positions', () => {
      render(<RetroDashboard {...defaultProps} investments={[]} />);

      expect(screen.getByText('NO ACTIVE POSITIONS')).toBeInTheDocument();
    });

    it('limits displayed positions to 5', () => {
      const manyInvestments = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        protocol_name: `Protocol ${i + 1}`,
        blockchain: 'ethereum',
        amount: 1000,
        expected_apy: 5,
        status: 'confirmed',
      }));

      render(<RetroDashboard {...defaultProps} investments={manyInvestments} />);

      expect(screen.getByText('Protocol 1')).toBeInTheDocument();
      expect(screen.getByText('Protocol 5')).toBeInTheDocument();
      expect(screen.queryByText('Protocol 6')).not.toBeInTheDocument();
    });
  });

  describe('Opportunities Table', () => {
    it('renders opportunities section', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('opportunities.scan')).toBeInTheDocument();
    });

    it('displays opportunities count in status', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('3 FOUND')).toBeInTheDocument();
    });

    it('displays opportunity rows', () => {
      render(<RetroDashboard {...defaultProps} />);

      // Protocol names should appear in both active positions and opportunities
      const aaveElements = screen.getAllByText('Aave V3');
      expect(aaveElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty message when no opportunities', () => {
      render(<RetroDashboard {...defaultProps} opportunities={[]} />);

      expect(screen.getByText('RUN SCAN TO DISCOVER OPPORTUNITIES')).toBeInTheDocument();
    });

    it('limits displayed opportunities to 5', () => {
      const manyOpportunities = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        protocol_name: `Opp Protocol ${i + 1}`,
        apy: 5,
        tvl: 1000000000,
        risk_score: 5,
      }));

      render(<RetroDashboard {...defaultProps} opportunities={manyOpportunities} />);

      expect(screen.getByText('Opp Protocol 1')).toBeInTheDocument();
      expect(screen.getByText('Opp Protocol 5')).toBeInTheDocument();
      expect(screen.queryByText('Opp Protocol 6')).not.toBeInTheDocument();
    });
  });

  describe('Terminal Output', () => {
    it('renders terminal section', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('system.log')).toBeInTheDocument();
    });

    it('displays initial system messages', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/0xCultiv8 Agent.*initialized/)).toBeInTheDocument();
      expect(screen.getByText(/Connected to Ethereum mainnet/)).toBeInTheDocument();
      expect(screen.getByText(/Connected to Base mainnet/)).toBeInTheDocument();
    });

    it('shows terminal prompt', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('$')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders RUN SCAN button', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('RUN SCAN')).toBeInTheDocument();
    });

    it('renders VIEW ALL OPPORTUNITIES button', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('VIEW ALL OPPORTUNITIES')).toBeInTheDocument();
    });

    it('renders AGENT TERMINAL button', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('AGENT TERMINAL')).toBeInTheDocument();
    });

    it('renders SETTINGS button', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    });

    it('navigates to opportunities when clicked', async () => {
      const user = userEvent.setup();
      render(<RetroDashboard {...defaultProps} />);

      const button = screen.getByText('VIEW ALL OPPORTUNITIES');
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/opportunities');
    });

    it('navigates to agent when clicked', async () => {
      const user = userEvent.setup();
      render(<RetroDashboard {...defaultProps} />);

      const button = screen.getByText('AGENT TERMINAL');
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/agent');
    });

    it('navigates to settings when clicked', async () => {
      const user = userEvent.setup();
      render(<RetroDashboard {...defaultProps} />);

      const button = screen.getByText('SETTINGS');
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('Scan Functionality', () => {
    it('calls onRunScan when provided', async () => {
      const user = userEvent.setup();
      const onRunScan = vi.fn();
      render(<RetroDashboard {...defaultProps} onRunScan={onRunScan} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      expect(onRunScan).toHaveBeenCalled();
    });

    it('calls API directly when onRunScan not provided', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, opportunities: [] }),
      });

      render(<RetroDashboard {...defaultProps} onRunScan={undefined} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      expect(mockFetch).toHaveBeenCalledWith('/api/agent/scan', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('shows SCANNING state during scan', async () => {
      const user = userEvent.setup();
      let resolveScan;
      const scanPromise = new Promise(resolve => { resolveScan = resolve; });
      const onRunScan = vi.fn(() => scanPromise);

      render(<RetroDashboard {...defaultProps} onRunScan={onRunScan} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      expect(screen.getByText('SCANNING...')).toBeInTheDocument();

      resolveScan();
    });

    it('disables button during scan', async () => {
      const user = userEvent.setup();
      let resolveScan;
      const scanPromise = new Promise(resolve => { resolveScan = resolve; });
      const onRunScan = vi.fn(() => scanPromise);

      render(<RetroDashboard {...defaultProps} onRunScan={onRunScan} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      const scanningButton = screen.getByText('SCANNING...');
      expect(scanningButton).toBeDisabled();

      resolveScan();
    });

    it('adds terminal output on scan', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, opportunities: [] }),
      });

      render(<RetroDashboard {...defaultProps} onRunScan={undefined} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/cultiv8 scan/)).toBeInTheDocument();
      });
    });

    it('shows success message after scan', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, opportunities: mockOpportunities }),
      });

      render(<RetroDashboard {...defaultProps} onRunScan={undefined} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Found 3 opportunities/)).toBeInTheDocument();
      });
    });

    it('shows error message on scan failure', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<RetroDashboard {...defaultProps} onRunScan={undefined} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      await waitFor(() => {
        // Error message appears in terminal output as [ERR]
        expect(screen.getByText(/\[ERR\]/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Wallet Connection', () => {
    it('shows wallet address when connected', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    });

    it('shows connect button when not connected', () => {
      render(<RetroDashboard {...defaultProps} isConnected={false} />);

      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('calls onConnect when connect clicked', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      render(<RetroDashboard {...defaultProps} isConnected={false} onConnect={onConnect} />);

      const button = screen.getByText('Connect Wallet');
      await user.click(button);

      expect(onConnect).toHaveBeenCalled();
    });

    it('shows status dot when connected', () => {
      render(<RetroDashboard {...defaultProps} />);

      const statusDot = document.querySelector('.status-dot--active');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Agent Status Animation', () => {
    it('displays agent message', async () => {
      render(<RetroDashboard {...defaultProps} />);

      // Initial message (typing animation shows partial text)
      await waitFor(() => {
        // Check that agent status message area exists and has content
        const agentStatus = document.querySelector('.agent-status__message');
        expect(agentStatus).toBeInTheDocument();
      });
    });

    it('updates message on scan', async () => {
      const user = userEvent.setup();
      let resolveScan;
      const scanPromise = new Promise(resolve => { resolveScan = resolve; });
      const onRunScan = vi.fn(() => scanPromise);

      render(<RetroDashboard {...defaultProps} onRunScan={onRunScan} />);

      const button = screen.getByText('RUN SCAN');
      await user.click(button);

      // During scanning, the status message should be updated
      // Check that agent status shows SCANNING state
      await waitFor(() => {
        expect(screen.getByText('SCANNING')).toBeInTheDocument();
      });

      resolveScan();
    });
  });

  describe('Footer Stats', () => {
    it('displays network information', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/NETWORKS: ETH.*BASE/)).toBeInTheDocument();
    });

    it('displays protocol information', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/PROTOCOLS: AAVE V3.*COMPOUND V3/)).toBeInTheDocument();
    });

    it('displays last sync time', () => {
      render(<RetroDashboard {...defaultProps} />);

      expect(screen.getByText(/LAST SYNC:/)).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('formats APY correctly in banner', () => {
      render(<RetroDashboard {...defaultProps} />);

      // Banner shows overall APY
      expect(screen.getByText(/APY: 9.40%/)).toBeInTheDocument();
    });

    it('formats TVL correctly in banner', () => {
      render(<RetroDashboard {...defaultProps} />);

      // Banner shows TVL
      expect(screen.getByText(/TVL: \$10,000/)).toBeInTheDocument();
    });

    it('formats blockchain names in uppercase', () => {
      render(<RetroDashboard {...defaultProps} />);

      // Investments have blockchain: 'ethereum' and 'base' which get uppercased
      expect(screen.getAllByText('ETHEREUM').length).toBeGreaterThan(0);
      expect(screen.getByText('BASE')).toBeInTheDocument();
    });
  });
});
