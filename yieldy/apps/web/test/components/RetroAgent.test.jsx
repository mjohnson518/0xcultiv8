/**
 * RetroAgent Component Tests
 *
 * Tests for the Agent page component including:
 * - Agent status display
 * - Control buttons (run agent, view history, settings)
 * - Execution terminal output
 * - Selected strategy display and approval workflow
 * - Reasoning chain visualization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetroAgent } from '@/components/Cultiv8Agent/RetroAgent';

// Mock the Retro components
vi.mock('@/components/Retro', () => ({
  RetroHeader: ({ walletAddress, isConnected, onConnect, navigation }) => (
    <header data-testid="retro-header">
      <span data-testid="wallet-address">{walletAddress}</span>
      <span data-testid="connected-status">{isConnected ? 'connected' : 'disconnected'}</span>
      <button onClick={onConnect} data-testid="connect-button">Connect</button>
    </header>
  ),
  RetroCard: ({ children, title, status, variant, collapsible, defaultExpanded }) => (
    <div data-testid={`card-${title?.toLowerCase().replace(/\s+/g, '-')}`} data-status={status} data-variant={variant}>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  RetroButton: ({ children, onClick, variant, disabled, size, href }) => {
    if (href) {
      return <a href={href} data-testid={`button-${children?.toString().toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>{children}</a>;
    }
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        data-variant={variant}
        data-size={size}
        data-testid={`button-${children?.toString().toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      >
        {children}
      </button>
    );
  },
  RetroAgentTerminal: ({ title, steps, maxHeight, showPrompt, onClear }) => (
    <div data-testid="agent-terminal">
      <h3>{title}</h3>
      {steps.map((step, i) => (
        <div key={i} data-testid={`terminal-step-${i}`}>
          <span>{step.step}</span>
          <span>{typeof step.output === 'string' ? step.output : JSON.stringify(step.output)}</span>
        </div>
      ))}
    </div>
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
  STATUS_ICONS: {
    active: '●',
    inactive: '○',
    loading: '◐',
  },
}));

describe('RetroAgent', () => {
  const defaultProps = {
    walletAddress: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    onConnect: vi.fn(),
    agentStatus: {
      operational: true,
      autoInvestEnabled: true,
      lastRun: '2024-01-15 14:30:00',
      nextScan: '2024-01-15 15:30:00',
      pendingApprovals: 2,
      totalScans: 150,
      successfulExecutions: 45,
      successRate: 87.5,
    },
    executionSteps: [],
    selectedStrategy: null,
    onRunAgent: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onViewHistory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the agent page with header', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByTestId('retro-header')).toBeInTheDocument();
    });

    it('renders agent status card', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByTestId('card-agent-status')).toBeInTheDocument();
    });

    it('shows OPERATIONAL status when agent is operational', () => {
      render(<RetroAgent {...defaultProps} />);

      const statusCard = screen.getByTestId('card-agent-status');
      expect(statusCard).toHaveAttribute('data-status', 'OPERATIONAL');
    });

    it('shows PAUSED status when agent is not operational', () => {
      render(<RetroAgent {...defaultProps} agentStatus={{ ...defaultProps.agentStatus, operational: false }} />);

      const statusCard = screen.getByTestId('card-agent-status');
      expect(statusCard).toHaveAttribute('data-status', 'PAUSED');
    });

    it('displays agent status details', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByText(/Auto-Invest:/)).toBeInTheDocument();
      expect(screen.getByText(/\[●ON\]/)).toBeInTheDocument();
      expect(screen.getByText(/Last Execution:/)).toBeInTheDocument();
      expect(screen.getByText(/Next Scan:/)).toBeInTheDocument();
      expect(screen.getByText(/Pending Approvals: 2/)).toBeInTheDocument();
    });

    it('shows auto-invest OFF when disabled', () => {
      render(<RetroAgent {...defaultProps} agentStatus={{ ...defaultProps.agentStatus, autoInvestEnabled: false }} />);

      expect(screen.getByText(/\[○OFF\]/)).toBeInTheDocument();
    });

    it('renders agent terminal', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByTestId('agent-terminal')).toBeInTheDocument();
    });

    it('renders quick stats', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByText('Total Scans')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Successful Executions')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
    });
  });

  describe('Control Buttons', () => {
    it('renders RUN AGENT button', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByText('RUN AGENT')).toBeInTheDocument();
    });

    it('renders AGENT SETTINGS link', () => {
      render(<RetroAgent {...defaultProps} />);

      const settingsLink = screen.getByTestId('button-agent-settings');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });

    it('renders VIEW HISTORY button', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByText('VIEW HISTORY')).toBeInTheDocument();
    });

    it('calls onRunAgent when RUN AGENT clicked', async () => {
      const user = userEvent.setup();
      const onRunAgent = vi.fn();
      render(<RetroAgent {...defaultProps} onRunAgent={onRunAgent} />);

      const runButton = screen.getByText('RUN AGENT');
      await user.click(runButton);

      expect(onRunAgent).toHaveBeenCalled();
    });

    it('shows RUNNING... when agent is running', async () => {
      const user = userEvent.setup();
      const onRunAgent = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<RetroAgent {...defaultProps} onRunAgent={onRunAgent} />);

      const runButton = screen.getByText('RUN AGENT');
      await user.click(runButton);

      expect(screen.getByText('RUNNING...')).toBeInTheDocument();
    });

    it('disables RUN AGENT button while running', async () => {
      const user = userEvent.setup();
      const onRunAgent = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<RetroAgent {...defaultProps} onRunAgent={onRunAgent} />);

      const runButton = screen.getByText('RUN AGENT');
      await user.click(runButton);

      expect(screen.getByText('RUNNING...')).toBeDisabled();
    });

    it('calls onViewHistory when VIEW HISTORY clicked', async () => {
      const user = userEvent.setup();
      const onViewHistory = vi.fn();
      render(<RetroAgent {...defaultProps} onViewHistory={onViewHistory} />);

      const historyButton = screen.getByText('VIEW HISTORY');
      await user.click(historyButton);

      expect(onViewHistory).toHaveBeenCalled();
    });
  });

  describe('Execution Terminal', () => {
    it('displays execution steps in terminal', () => {
      const executionSteps = [
        { step: 'scan', output: 'Scanning protocols...', model: 'gpt-4' },
        { step: 'analyze', output: 'Analyzing opportunities...', model: 'claude-3' },
      ];

      render(<RetroAgent {...defaultProps} executionSteps={executionSteps} />);

      expect(screen.getByTestId('terminal-step-0')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-step-1')).toBeInTheDocument();
    });

    it('renders reasoning chain when steps available', () => {
      const executionSteps = [
        { step: 'decide', output: 'Evaluating risk-reward...', model: 'claude-3' },
      ];

      render(<RetroAgent {...defaultProps} executionSteps={executionSteps} />);

      expect(screen.getByTestId('card-reasoning-chain')).toBeInTheDocument();
    });

    it('does not render reasoning chain when no steps', () => {
      render(<RetroAgent {...defaultProps} executionSteps={[]} />);

      expect(screen.queryByTestId('card-reasoning-chain')).not.toBeInTheDocument();
    });
  });

  describe('Selected Strategy', () => {
    const mockStrategy = {
      protocol: 'aave',
      blockchain: 'ethereum',
      amount: 5000,
      expectedAPY: 8.5,
      riskScore: 3.2,
      confidence: 0.85,
      rationale: 'Strong yield opportunity with established protocol.',
      needsApproval: true,
    };

    it('does not render strategy card when no strategy selected', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={null} />);

      expect(screen.queryByTestId('card-selected--aave--ethereum-')).not.toBeInTheDocument();
    });

    it('renders strategy card when strategy selected', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} />);

      expect(screen.getByTestId('card-selected-strategy')).toBeInTheDocument();
    });

    it('displays strategy details', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} />);

      const strategyCard = screen.getByTestId('card-selected-strategy');
      expect(strategyCard).toHaveTextContent('AAVE');
      expect(strategyCard).toHaveTextContent('ETHEREUM');
      expect(strategyCard).toHaveTextContent('$5,000');
      expect(strategyCard).toHaveTextContent('8.50%');
      expect(strategyCard).toHaveTextContent('3.2/10');
      expect(strategyCard).toHaveTextContent('85%');
    });

    it('displays strategy rationale', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} />);

      expect(screen.getByText('Strong yield opportunity with established protocol.')).toBeInTheDocument();
    });

    it('shows APPROVAL REQUIRED status when needs approval', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} />);

      const strategyCard = screen.getByTestId('card-selected-strategy');
      expect(strategyCard).toHaveAttribute('data-status', 'APPROVAL REQUIRED');
    });

    it('shows READY status when does not need approval', () => {
      const strategyNoApproval = { ...mockStrategy, needsApproval: false };
      render(<RetroAgent {...defaultProps} selectedStrategy={strategyNoApproval} />);

      const strategyCard = screen.getByTestId('card-selected-strategy');
      expect(strategyCard).toHaveAttribute('data-status', 'READY');
    });

    it('renders approve and reject buttons when needs approval', () => {
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} />);

      expect(screen.getByText('[✓ APPROVE]')).toBeInTheDocument();
      expect(screen.getByText('[✗ REJECT]')).toBeInTheDocument();
    });

    it('does not render approve/reject buttons when no approval needed', () => {
      const strategyNoApproval = { ...mockStrategy, needsApproval: false };
      render(<RetroAgent {...defaultProps} selectedStrategy={strategyNoApproval} />);

      expect(screen.queryByText('[✓ APPROVE]')).not.toBeInTheDocument();
      expect(screen.queryByText('[✗ REJECT]')).not.toBeInTheDocument();
    });

    it('calls onApprove when approve button clicked', async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} onApprove={onApprove} />);

      const approveButton = screen.getByText('[✓ APPROVE]');
      await user.click(approveButton);

      expect(onApprove).toHaveBeenCalledWith(mockStrategy);
    });

    it('calls onReject when reject button clicked', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      render(<RetroAgent {...defaultProps} selectedStrategy={mockStrategy} onReject={onReject} />);

      const rejectButton = screen.getByText('[✗ REJECT]');
      await user.click(rejectButton);

      expect(onReject).toHaveBeenCalledWith(mockStrategy);
    });
  });

  describe('Wallet Connection', () => {
    it('shows connected status when wallet connected', () => {
      render(<RetroAgent {...defaultProps} isConnected={true} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('connected');
    });

    it('shows disconnected status when wallet not connected', () => {
      render(<RetroAgent {...defaultProps} isConnected={false} />);

      expect(screen.getByTestId('connected-status')).toHaveTextContent('disconnected');
    });

    it('displays wallet address', () => {
      render(<RetroAgent {...defaultProps} />);

      expect(screen.getByTestId('wallet-address')).toHaveTextContent(defaultProps.walletAddress);
    });
  });

  describe('Empty/Default States', () => {
    it('handles null agentStatus gracefully', () => {
      render(<RetroAgent {...defaultProps} agentStatus={null} />);

      // When agentStatus is null, component shows default values
      expect(screen.getByText(/Last Execution: Never/)).toBeInTheDocument();
      expect(screen.getByText(/Next Scan: Not scheduled/)).toBeInTheDocument();
    });

    it('handles empty executionSteps', () => {
      render(<RetroAgent {...defaultProps} executionSteps={[]} />);

      expect(screen.getByTestId('agent-terminal')).toBeInTheDocument();
    });

    it('shows 0 for stats when agentStatus is null', () => {
      render(<RetroAgent {...defaultProps} agentStatus={null} />);

      // All stats should show 0
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });
  });
});
