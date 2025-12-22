/**
 * RetroSettings Component Tests
 *
 * Tests for the Settings page component including:
 * - Configuration form rendering and validation
 * - Authorization status display
 * - Fee structure display
 * - User interactions (save, update limits, revoke, upgrade tier)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetroSettings } from '@/components/Cultiv8Agent/RetroSettings';

// Mock the Retro components
vi.mock('@/components/Retro', () => ({
  RetroHeader: ({ walletAddress, isConnected, onConnect, navigation }) => (
    <header data-testid="retro-header">
      <span data-testid="wallet-address">{walletAddress}</span>
      <span data-testid="connected-status">{isConnected ? 'connected' : 'disconnected'}</span>
      <button onClick={onConnect} data-testid="connect-button">Connect</button>
      {navigation?.map((nav, i) => (
        <a key={i} href={nav.href} data-active={nav.active}>{nav.label}</a>
      ))}
    </header>
  ),
  RetroCard: ({ children, title, status, variant, collapsible, defaultExpanded }) => (
    <div data-testid={`card-${title?.toLowerCase().replace(/\s+/g, '-')}`} data-status={status} data-variant={variant}>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  RetroButton: ({ children, onClick, variant, disabled, size, href, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid={`button-${children?.toString().toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      className={className}
    >
      {children}
    </button>
  ),
  RetroModal: ({ isOpen, onClose, title, children, footer, variant }) => (
    isOpen ? (
      <div data-testid="modal" data-variant={variant}>
        <h3>{title}</h3>
        {children}
        <div data-testid="modal-footer">{footer}</div>
      </div>
    ) : null
  ),
  RetroFeeTable: ({ currentTier, currentAUM }) => (
    <div data-testid="fee-table" data-tier={currentTier} data-aum={currentAUM}>Fee Table</div>
  ),
  RetroFeeBreakdown: ({ tier, aum, monthlyMgmtFee, annualMgmtFee }) => (
    <div data-testid="fee-breakdown" data-tier={tier}>
      <span data-testid="monthly-fee">{monthlyMgmtFee}</span>
      <span data-testid="annual-fee">{annualMgmtFee}</span>
    </div>
  ),
}));

// Mock hooks
vi.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => [false, vi.fn()],
}));

// Mock utilities
vi.mock('@/utils/asciiArt', () => ({
  STATUS_ICONS: {
    active: '●',
    inactive: '○',
    loading: '◐',
  },
  createPercentageBar: (current, max, width) => `[${'█'.repeat(Math.round((current/max) * width))}${'░'.repeat(width - Math.round((current/max) * width))}]`,
}));

vi.mock('@/utils/feeCalculator', () => ({
  calculateMonthlyManagementFee: (aum, tier) => aum * 0.001,
  calculateAnnualManagementFee: (aum, tier) => aum * 0.012,
  FEE_TIERS: {
    community: { managementFee: 0.012, performanceFee: 0.10 },
    grower: { managementFee: 0.010, performanceFee: 0.12 },
    cultivator: { managementFee: 0.008, performanceFee: 0.15 },
  },
}));

describe('RetroSettings', () => {
  const defaultProps = {
    config: {
      auto_invest_enabled: true,
      max_investment_per_opportunity: 1000,
      max_total_investment: 10000,
      min_apy_threshold: 5.0,
      max_risk_score: 7,
      user_tier: 'community',
      total_aum: 50000,
    },
    authorization: null,
    walletAddress: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    onConnect: vi.fn(),
    onSaveConfig: vi.fn(),
    onUpdateLimits: vi.fn(),
    onRevoke: vi.fn(),
    onAuthorize: vi.fn(),
    onUpgradeTier: vi.fn(),
    isLoading: false,
    txStatus: null,
    authError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the settings page with header', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('retro-header')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-address')).toHaveTextContent(defaultProps.walletAddress);
    });

    it('renders agent configuration card', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('card-agent-configuration')).toBeInTheDocument();
    });

    it('renders authorization status card', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('card-authorization-status')).toBeInTheDocument();
    });

    it('renders fee structure card', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('card-fee-structure')).toBeInTheDocument();
    });

    it('renders risk framework card', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('card-risk-framework')).toBeInTheDocument();
    });

    it('shows NOT AUTHORIZED status when no authorization', () => {
      render(<RetroSettings {...defaultProps} authorization={null} />);

      const authCard = screen.getByTestId('card-authorization-status');
      expect(authCard).toHaveAttribute('data-status', 'NOT AUTHORIZED');
    });
  });

  describe('Agent Configuration Form', () => {
    it('displays current config values in form', () => {
      render(<RetroSettings {...defaultProps} />);

      // Check auto-invest toggle shows ON in the config section
      const configCard = screen.getByTestId('card-agent-configuration');
      expect(configCard).toHaveTextContent('[●ON]');
    });

    it('toggles auto-invest when button clicked', async () => {
      const user = userEvent.setup();
      render(<RetroSettings {...defaultProps} />);

      // Find the auto-invest toggle button specifically
      const configCard = screen.getByTestId('card-agent-configuration');
      const toggleButton = configCard.querySelector('button');
      expect(toggleButton).toHaveTextContent('[●ON]');
      await user.click(toggleButton);

      expect(toggleButton).toHaveTextContent('[○OFF]');
    });

    it('updates max investment per opportunity', async () => {
      const user = userEvent.setup();
      render(<RetroSettings {...defaultProps} />);

      const input = screen.getAllByRole('spinbutton')[0];
      await user.clear(input);
      await user.type(input, '2000');

      expect(input).toHaveValue(2000);
    });

    it('calls onSaveConfig when save button clicked', async () => {
      const user = userEvent.setup();
      const onSaveConfig = vi.fn();
      render(<RetroSettings {...defaultProps} onSaveConfig={onSaveConfig} />);

      const saveButton = screen.getByTestId('button----save-settings-');
      await user.click(saveButton);

      expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        autoInvest: true,
        maxPerOpp: 1000,
        maxTotal: 10000,
        minAPY: 5.0,
        maxRisk: 7,
      }));
    });
  });

  describe('Authorization Status - Not Authorized', () => {
    it('shows authorize button when not authorized', () => {
      render(<RetroSettings {...defaultProps} authorization={null} />);

      expect(screen.getByText('AUTHORIZE AGENT')).toBeInTheDocument();
    });

    it('calls onAuthorize when authorize button clicked', async () => {
      const user = userEvent.setup();
      const onAuthorize = vi.fn();
      render(<RetroSettings {...defaultProps} authorization={null} onAuthorize={onAuthorize} />);

      const authButton = screen.getByText('AUTHORIZE AGENT');
      await user.click(authButton);

      expect(onAuthorize).toHaveBeenCalled();
    });

    it('falls back to onConnect if onAuthorize not provided', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      render(<RetroSettings {...defaultProps} authorization={null} onAuthorize={null} onConnect={onConnect} />);

      const authButton = screen.getByText('AUTHORIZE AGENT');
      await user.click(authButton);

      expect(onConnect).toHaveBeenCalled();
    });
  });

  describe('Authorization Status - Authorized', () => {
    const authorizedProps = {
      ...defaultProps,
      authorization: {
        active: true,
        maxAmountPerTx: 1000000000, // $1000 in micro units
        dailyLimit: 5000000000, // $5000 in micro units
        dailySpent: 500000000, // $500 in micro units
      },
    };

    it('shows AUTHORIZED status when authorized', () => {
      render(<RetroSettings {...authorizedProps} />);

      const authCard = screen.getByTestId('card-authorization-status');
      expect(authCard).toHaveAttribute('data-status', 'AUTHORIZED');
    });

    it('displays authorization limits', () => {
      render(<RetroSettings {...authorizedProps} />);

      expect(screen.getByText('$1,000')).toBeInTheDocument(); // Max per tx
      expect(screen.getByText('$5,000')).toBeInTheDocument(); // Daily limit
    });

    it('shows update limits form', () => {
      render(<RetroSettings {...authorizedProps} />);

      expect(screen.getByText('Update Limits:')).toBeInTheDocument();
    });

    it('calls onUpdateLimits when update button clicked', async () => {
      const user = userEvent.setup();
      const onUpdateLimits = vi.fn();
      render(<RetroSettings {...authorizedProps} onUpdateLimits={onUpdateLimits} />);

      const updateButton = screen.getByText('UPDATE LIMITS');
      await user.click(updateButton);

      expect(onUpdateLimits).toHaveBeenCalledWith(expect.objectContaining({
        maxPerTx: expect.any(Number),
        dailyLimit: expect.any(Number),
      }));
    });

    it('shows revoke button', () => {
      render(<RetroSettings {...authorizedProps} />);

      expect(screen.getByText('REVOKE')).toBeInTheDocument();
    });

    it('opens revoke confirmation modal when revoke clicked', async () => {
      const user = userEvent.setup();
      render(<RetroSettings {...authorizedProps} />);

      const revokeButton = screen.getByText('REVOKE');
      await user.click(revokeButton);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('CONFIRM REVOCATION')).toBeInTheDocument();
    });

    it('calls onRevoke when revoke confirmed', async () => {
      const user = userEvent.setup();
      const onRevoke = vi.fn();
      render(<RetroSettings {...authorizedProps} onRevoke={onRevoke} />);

      // Open modal
      const revokeButton = screen.getByText('REVOKE');
      await user.click(revokeButton);

      // Confirm revoke
      const confirmButton = screen.getByText('REVOKE NOW');
      await user.click(confirmButton);

      expect(onRevoke).toHaveBeenCalled();
    });

    it('closes modal when cancel clicked', async () => {
      const user = userEvent.setup();
      render(<RetroSettings {...authorizedProps} />);

      // Open modal
      const revokeButton = screen.getByText('REVOKE');
      await user.click(revokeButton);

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      // Cancel
      const cancelButton = screen.getByText('CANCEL');
      await user.click(cancelButton);

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Fee Structure', () => {
    it('displays fee breakdown', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('fee-breakdown')).toBeInTheDocument();
    });

    it('displays fee table', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByTestId('fee-table')).toBeInTheDocument();
    });

    it('shows upgrade tier button', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByText('[Ξ UPGRADE TIER]')).toBeInTheDocument();
    });

    it('calls onUpgradeTier when upgrade button clicked', async () => {
      const user = userEvent.setup();
      const onUpgradeTier = vi.fn();
      render(<RetroSettings {...defaultProps} onUpgradeTier={onUpgradeTier} />);

      const upgradeButton = screen.getByText('[Ξ UPGRADE TIER]');
      await user.click(upgradeButton);

      expect(onUpgradeTier).toHaveBeenCalled();
    });

    it('disables upgrade button when loading', () => {
      render(<RetroSettings {...defaultProps} isLoading={true} />);

      const upgradeButton = screen.getByText('[...LOADING]');
      expect(upgradeButton).toBeDisabled();
    });
  });

  describe('Risk Framework', () => {
    it('displays risk tolerance slider', () => {
      render(<RetroSettings {...defaultProps} />);

      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveValue('7');
    });

    it('updates risk score when slider changed', async () => {
      const user = userEvent.setup();
      render(<RetroSettings {...defaultProps} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '4' } });

      expect(slider).toHaveValue('4');
    });

    it('displays risk level guide', () => {
      render(<RetroSettings {...defaultProps} />);

      expect(screen.getByText(/LOW RISK/)).toBeInTheDocument();
      expect(screen.getByText(/MEDIUM RISK/)).toBeInTheDocument();
      expect(screen.getByText(/HIGH RISK/)).toBeInTheDocument();
      expect(screen.getByText(/CRITICAL RISK/)).toBeInTheDocument();
    });
  });

  describe('Wallet Connection', () => {
    it('shows connected status when wallet connected', () => {
      render(<RetroSettings {...defaultProps} isConnected={true} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('connected');
    });

    it('shows disconnected status when wallet not connected', () => {
      render(<RetroSettings {...defaultProps} isConnected={false} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('disconnected');
    });

    it('calls onConnect when connect button clicked', async () => {
      const user = userEvent.setup();
      const onConnect = vi.fn();
      render(<RetroSettings {...defaultProps} isConnected={false} onConnect={onConnect} />);

      const connectButton = screen.getByTestId('connect-button');
      await user.click(connectButton);

      expect(onConnect).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading text on upgrade button when loading', () => {
      render(<RetroSettings {...defaultProps} isLoading={true} />);

      expect(screen.getByText('[...LOADING]')).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('renders without dark mode by default', () => {
      render(<RetroSettings {...defaultProps} />);

      // Component should render without errors
      expect(screen.getByTestId('retro-header')).toBeInTheDocument();
    });
  });
});
