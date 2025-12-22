/**
 * RetroOpportunities Component Tests
 *
 * Tests for the Opportunities page component including:
 * - Opportunities table rendering
 * - Filtering by chain
 * - Row selection and detail view
 * - Invest action
 * - Refresh functionality
 * - Loading and empty states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetroOpportunities } from '@/components/Cultiv8Agent/RetroOpportunities';

// Mock the Retro components
vi.mock('@/components/Retro', () => ({
  RetroHeader: ({ walletAddress, isConnected, onConnect }) => (
    <header data-testid="retro-header">
      <span data-testid="wallet-address">{walletAddress}</span>
      <span data-testid="connected-status">{isConnected ? 'connected' : 'disconnected'}</span>
      <button onClick={onConnect} data-testid="connect-button">Connect</button>
    </header>
  ),
  RetroCard: ({ children, title, status, variant, footer }) => (
    <div data-testid={`card-${title?.toLowerCase().replace(/\s+/g, '-')}`} data-status={status} data-variant={variant}>
      <h2>{title}</h2>
      {children}
      {footer && <footer data-testid="card-footer">{footer}</footer>}
    </div>
  ),
  RetroButton: ({ children, onClick, variant, disabled, size }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid={`button-${children?.toString().toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
    >
      {children}
    </button>
  ),
  RetroTable: ({ columns, data, onRowClick }) => (
    <table data-testid="opportunities-table">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} data-sortable={col.sortable}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr
            key={row.id || i}
            data-testid={`table-row-${row.id}`}
            onClick={() => onRowClick && onRowClick(row)}
            style={{ cursor: 'pointer' }}
          >
            {columns.map((col, j) => (
              <td key={j}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  RetroLoader: ({ message, variant }) => (
    <div data-testid="loader">{message}</div>
  ),
}));

// Mock hooks
vi.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => [false, vi.fn()],
}));

// Mock utilities
vi.mock('@/utils/asciiArt', () => ({
  RISK_LEVELS: {
    low: '●LOW',
    medium: '●MEDIUM',
    high: '●HIGH',
    veryHigh: '●VERY HIGH',
  },
  STATUS_ICONS: {
    loading: '◐',
  },
  createPercentageBar: () => '[████░░░░░░]',
}));

describe('RetroOpportunities', () => {
  const mockOpportunities = [
    {
      id: 1,
      protocol_name: 'Aave V3',
      blockchain: 'ethereum',
      apy: 8.5,
      tvl: 5000000000, // $5B
      risk_score: 3,
      minimum_deposit: 10,
      token_symbol: 'USDC',
      protocol_type: 'lending',
      risk_breakdown: {
        protocol: 2,
        financial: 3,
        technical: 4,
        market: 3,
      },
    },
    {
      id: 2,
      protocol_name: 'Compound V3',
      blockchain: 'ethereum',
      apy: 7.2,
      tvl: 3000000000, // $3B
      risk_score: 4,
      minimum_deposit: 100,
      token_symbol: 'USDC',
      protocol_type: 'lending',
    },
    {
      id: 3,
      protocol_name: 'Morpho Blue',
      blockchain: 'base',
      apy: 12.5,
      tvl: 500000000, // $500M
      risk_score: 6,
      minimum_deposit: 50,
      token_symbol: 'USDC',
      protocol_type: 'lending',
    },
  ];

  const defaultProps = {
    opportunities: mockOpportunities,
    walletAddress: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    onConnect: vi.fn(),
    onInvest: vi.fn(),
    onRefresh: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the opportunities page with header', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByTestId('retro-header')).toBeInTheDocument();
    });

    it('renders protocol opportunities card', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByTestId('card-protocol-opportunities')).toBeInTheDocument();
    });

    it('shows opportunities count in status', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const card = screen.getByTestId('card-protocol-opportunities');
      expect(card).toHaveAttribute('data-status', '3 AVAILABLE');
    });

    it('renders opportunities table', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByTestId('opportunities-table')).toBeInTheDocument();
    });

    it('displays all opportunity rows', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByTestId('table-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-2')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-3')).toBeInTheDocument();
    });

    it('displays table headers', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByText('PROTOCOL')).toBeInTheDocument();
      expect(screen.getByText('CHAIN')).toBeInTheDocument();
      expect(screen.getByText('APY')).toBeInTheDocument();
      expect(screen.getByText('TVL')).toBeInTheDocument();
      expect(screen.getByText('RISK')).toBeInTheDocument();
    });
  });

  describe('Chain Filtering', () => {
    it('renders chain filter dropdown', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByText('FILTER:')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows all chains by default', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('all');
    });

    it('filters to ethereum when selected', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'ethereum');

      // Should only show ethereum opportunities (2 of 3)
      expect(screen.getByTestId('table-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-2')).toBeInTheDocument();
      expect(screen.queryByTestId('table-row-3')).not.toBeInTheDocument();
    });

    it('filters to base when selected', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'base');

      // Should only show base opportunity (1 of 3)
      expect(screen.queryByTestId('table-row-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('table-row-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('table-row-3')).toBeInTheDocument();
    });

    it('updates count when filtered', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'base');

      const card = screen.getByTestId('card-protocol-opportunities');
      expect(card).toHaveAttribute('data-status', '1 AVAILABLE');
    });

    it('shows footer with filter status', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByTestId('card-footer')).toHaveTextContent('all chains');

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'ethereum');

      expect(screen.getByTestId('card-footer')).toHaveTextContent('ETHEREUM');
    });
  });

  describe('Refresh Button', () => {
    it('renders refresh button', () => {
      render(<RetroOpportunities {...defaultProps} />);

      expect(screen.getByText(/REFRESH/)).toBeInTheDocument();
    });

    it('calls onRefresh when clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();
      render(<RetroOpportunities {...defaultProps} onRefresh={onRefresh} />);

      const refreshButton = screen.getByText(/REFRESH/);
      await user.click(refreshButton);

      expect(onRefresh).toHaveBeenCalled();
    });

    it('is disabled when loading', () => {
      render(<RetroOpportunities {...defaultProps} loading={true} />);

      const refreshButton = screen.getByText(/REFRESH/);
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Row Selection', () => {
    it('selects opportunity when row clicked', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      // Should show selected opportunity details
      expect(screen.getByText('SELECTED: AAVE V3 (ETHEREUM)')).toBeInTheDocument();
    });

    it('displays selected opportunity details', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      // Details panel should show opportunity info
      const selectedText = screen.getByText('SELECTED: AAVE V3 (ETHEREUM)');
      expect(selectedText).toBeInTheDocument();

      // Check for detail values in the selected panel
      const detailPanel = selectedText.closest('div');
      expect(detailPanel).toHaveTextContent('$5.00B');
      expect(detailPanel).toHaveTextContent('3.0/10');
      expect(detailPanel).toHaveTextContent('$10');
    });

    it('displays risk breakdown when available', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      expect(screen.getByText('RISK BREAKDOWN:')).toBeInTheDocument();
    });

    it('shows invest button when opportunity selected', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      expect(screen.getByText('[$ INVEST NOW]')).toBeInTheDocument();
    });

    it('shows close button when opportunity selected', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      expect(screen.getByText('[× CLOSE]')).toBeInTheDocument();
    });

    it('closes selected opportunity when close clicked', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} />);

      // Select opportunity
      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      expect(screen.getByText('SELECTED: AAVE V3 (ETHEREUM)')).toBeInTheDocument();

      // Close it
      const closeButton = screen.getByText('[× CLOSE]');
      await user.click(closeButton);

      expect(screen.queryByText('SELECTED: AAVE V3 (ETHEREUM)')).not.toBeInTheDocument();
    });
  });

  describe('Invest Action', () => {
    it('calls onInvest with selected opportunity when invest clicked', async () => {
      const user = userEvent.setup();
      const onInvest = vi.fn();
      render(<RetroOpportunities {...defaultProps} onInvest={onInvest} />);

      // Select opportunity
      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      // Click invest
      const investButton = screen.getByText('[$ INVEST NOW]');
      await user.click(investButton);

      expect(onInvest).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        protocol_name: 'Aave V3',
        blockchain: 'ethereum',
      }));
    });

    it('disables invest button when wallet not connected', async () => {
      const user = userEvent.setup();
      render(<RetroOpportunities {...defaultProps} isConnected={false} />);

      // Select opportunity
      const row = screen.getByTestId('table-row-1');
      await user.click(row);

      // Invest button should be disabled
      const investButton = screen.getByText('[$ INVEST NOW]');
      expect(investButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows loader when loading', () => {
      render(<RetroOpportunities {...defaultProps} loading={true} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.getByText('SCANNING PROTOCOLS...')).toBeInTheDocument();
    });

    it('hides table when loading', () => {
      render(<RetroOpportunities {...defaultProps} loading={true} />);

      expect(screen.queryByTestId('opportunities-table')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no opportunities', () => {
      render(<RetroOpportunities {...defaultProps} opportunities={[]} />);

      expect(screen.getByText('NO OPPORTUNITIES FOUND')).toBeInTheDocument();
      expect(screen.getByText('Try running an agent scan')).toBeInTheDocument();
    });

    it('shows 0 AVAILABLE status when empty', () => {
      render(<RetroOpportunities {...defaultProps} opportunities={[]} />);

      const card = screen.getByTestId('card-protocol-opportunities');
      expect(card).toHaveAttribute('data-status', '0 AVAILABLE');
    });
  });

  describe('Wallet Connection', () => {
    it('shows connected status', () => {
      render(<RetroOpportunities {...defaultProps} isConnected={true} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('connected');
    });

    it('shows disconnected status', () => {
      render(<RetroOpportunities {...defaultProps} isConnected={false} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('disconnected');
    });

    it('calls onConnect when connect clicked', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      render(<RetroOpportunities {...defaultProps} isConnected={false} onConnect={onConnect} />);

      const connectButton = screen.getByTestId('connect-button');
      await user.click(connectButton);

      expect(onConnect).toHaveBeenCalled();
    });
  });

  describe('Data Formatting', () => {
    it('formats APY with 2 decimal places', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const table = screen.getByTestId('opportunities-table');
      expect(within(table).getByText('8.50%')).toBeInTheDocument();
      expect(within(table).getByText('7.20%')).toBeInTheDocument();
      expect(within(table).getByText('12.50%')).toBeInTheDocument();
    });

    it('formats TVL in millions', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const table = screen.getByTestId('opportunities-table');
      expect(within(table).getByText('$5000.0M')).toBeInTheDocument();
      expect(within(table).getByText('$3000.0M')).toBeInTheDocument();
      expect(within(table).getByText('$500.0M')).toBeInTheDocument();
    });

    it('formats risk score with /10', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const table = screen.getByTestId('opportunities-table');
      expect(within(table).getByText('3/10')).toBeInTheDocument();
      expect(within(table).getByText('4/10')).toBeInTheDocument();
      expect(within(table).getByText('6/10')).toBeInTheDocument();
    });

    it('shows chain name in uppercase', () => {
      render(<RetroOpportunities {...defaultProps} />);

      const table = screen.getByTestId('opportunities-table');
      // Chain names are formatted from blockchain field
      expect(within(table).getAllByText('ETHEREUM').length).toBeGreaterThan(0);
      expect(within(table).getByText('BASE')).toBeInTheDocument();
    });
  });
});
