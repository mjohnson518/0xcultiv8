import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import '../../styles/retro-theme.css';

/**
 * ASCII Art Banner
 */
const ASCII_LOGO = `
 ██████╗ ██╗  ██╗ ██████╗██╗   ██╗██╗  ████████╗██╗██╗   ██╗ █████╗
██╔═████╗╚██╗██╔╝██╔════╝██║   ██║██║  ╚══██╔══╝██║██║   ██║██╔══██╗
██║██╔██║ ╚███╔╝ ██║     ██║   ██║██║     ██║   ██║██║   ██║╚█████╔╝
████╔╝██║ ██╔██╗ ██║     ██║   ██║██║     ██║   ██║╚██╗ ██╔╝██╔══██╗
╚██████╔╝██╔╝ ██╗╚██████╗╚██████╔╝███████╗██║   ██║ ╚████╔╝ ╚█████╔╝
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═══╝   ╚════╝
`;

/**
 * Terminal Window Component
 */
function TerminalWindow({ title, status, statusType = 'active', children }) {
  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="terminal-dot terminal-dot--red" />
          <span className="terminal-dot terminal-dot--yellow" />
          <span className="terminal-dot terminal-dot--green" />
        </div>
        <span className="terminal-title">{title}</span>
        {status && (
          <span className={`terminal-status terminal-status--${statusType}`}>
            {status}
          </span>
        )}
      </div>
      <div className="terminal-body">
        {children}
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({ label, value, change, changeType, variant = 'green' }) {
  return (
    <div className="crt-card">
      <div className="metric-block">
        <div className={`metric-block__value ${variant === 'amber' ? 'metric-block__value--amber' : variant === 'white' ? 'metric-block__value--white' : ''}`}>
          {value}
        </div>
        <div className="metric-block__label">{label}</div>
        {change && (
          <div className={`metric-block__change ${changeType === 'positive' ? 'metric-block__change--positive' : 'metric-block__change--negative'}`}>
            {changeType === 'positive' ? '↑' : '↓'} {change}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Agent Status Component with typing animation
 */
function AgentStatus({ status = 'idle', message = '' }) {
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (message) {
      let index = 0;
      setDisplayedMessage('');
      const interval = setInterval(() => {
        if (index < message.length) {
          setDisplayedMessage(prev => prev + message[index]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [message]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    idle: { icon: '◉', color: 'var(--text-muted)', label: 'STANDBY' },
    scanning: { icon: '◎', color: 'var(--phosphor-green)', label: 'SCANNING' },
    executing: { icon: '◈', color: 'var(--phosphor-amber)', label: 'EXECUTING' },
    error: { icon: '◆', color: 'var(--status-error)', label: 'ERROR' },
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div className="agent-status">
      <div
        className={`agent-status__icon ${status === 'scanning' ? 'agent-status__icon--scanning' : ''}`}
        style={{ color: config.color, borderColor: config.color }}
      >
        {config.icon}
      </div>
      <div className="agent-status__info">
        <div className="agent-status__state" style={{ color: config.color }}>
          {config.label}
        </div>
        <div className="agent-status__message">
          {displayedMessage}
          <span style={{ opacity: cursorVisible ? 1 : 0, color: 'var(--phosphor-green)' }}>▌</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Data Table Component
 */
function DataTable({ columns, data, emptyMessage = 'NO DATA AVAILABLE' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-terminal)',
          fontSize: '14px',
          color: 'var(--text-muted)'
        }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <table className="crt-table crt-table--striped">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{ textAlign: col.align || 'left' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row.id || i}>
            {columns.map((col, j) => (
              <td key={j} style={{ textAlign: col.align || 'left' }}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Button Component
 */
function CRTButton({ children, variant = 'default', disabled, onClick, ...props }) {
  return (
    <button
      className={`crt-button ${variant === 'primary' ? 'crt-button--primary' : variant === 'danger' ? 'crt-button--danger' : ''}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Main Dashboard Component
 */
export function RetroDashboard({
  config,
  opportunities = [],
  investments = [],
  walletAddress,
  isConnected,
  onConnect,
  onRunScan,
}) {
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState('idle');
  const [agentMessage, setAgentMessage] = useState('Autonomous DeFi agent ready. Awaiting instructions...');
  const navigate = useNavigate();

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalValue = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const avgAPY = investments.length > 0
      ? investments.reduce((sum, inv) => sum + Number(inv.expected_apy || 0), 0) / investments.length
      : 0;
    const activePositions = investments.filter(i => i.status === 'confirmed' || i.status === 'pending').length;
    const avgRisk = investments.length > 0
      ? investments.reduce((sum, inv) => sum + Number(inv.risk_score || 5), 0) / investments.length
      : 0;

    return { totalValue, avgAPY, activePositions, avgRisk };
  }, [investments]);

  // Simulated terminal output
  const [terminalLines, setTerminalLines] = useState([
    { type: 'system', text: '[SYS] 0xCultiv8 Agent v2.0.0 initialized' },
    { type: 'info', text: '[NET] Connected to Ethereum mainnet' },
    { type: 'info', text: '[NET] Connected to Base mainnet' },
    { type: 'success', text: '[OK]  Protocol adapters loaded: Aave V3, Compound V3' },
    { type: 'info', text: '[MCP] DeFi Oracle server online' },
  ]);

  const handleRunScan = async () => {
    setLoading(true);
    setAgentStatus('scanning');
    setAgentMessage('Scanning Ethereum and Base networks for yield opportunities...');

    // Add terminal output
    setTerminalLines(prev => [...prev,
      { type: 'command', text: '$ cultiv8 scan --chains=eth,base --min-apy=5' }
    ]);

    try {
      if (onRunScan) {
        await onRunScan();
      } else {
        const response = await fetch('/api/agent/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockchain: 'both',
            scanOnly: true,
            forceRun: true
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setTerminalLines(prev => [...prev,
            { type: 'success', text: `[OK]  Found ${data.opportunities?.length || 0} opportunities` }
          ]);
          setAgentStatus('idle');
          setAgentMessage(`Scan complete. Found ${data.opportunities?.length || 0} yield opportunities.`);
        } else {
          throw new Error('Scan failed');
        }
      }
    } catch (error) {
      setTerminalLines(prev => [...prev,
        { type: 'error', text: `[ERR] ${error.message}` }
      ]);
      setAgentStatus('error');
      setAgentMessage('Scan failed. Check network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="crt-screen">
      {/* CRT Noise Texture */}
      <div className="crt-noise" />

      {/* Header */}
      <header className="crt-header">
        <div className="crt-header__logo">
          <div className="crt-header__logo-icon">
            <span style={{ color: 'var(--crt-black)', fontSize: '18px', fontWeight: 'bold' }}>◈</span>
          </div>
          <span className="crt-header__logo-text">0xCULTIV8</span>
        </div>

        <nav className="crt-header__nav">
          <a href="/" className="crt-header__nav-link crt-header__nav-link--active">Dashboard</a>
          <a href="/agent" className="crt-header__nav-link">Agent</a>
          <a href="/opportunities" className="crt-header__nav-link">Opportunities</a>
          <a href="/settings" className="crt-header__nav-link">Settings</a>
        </nav>

        <div className="crt-header__actions">
          {isConnected ? (
            <div className="wallet-badge">
              <span className="status-dot status-dot--active" />
              <span className="wallet-badge__address">{formatAddress(walletAddress)}</span>
            </div>
          ) : (
            <CRTButton variant="primary" onClick={onConnect}>
              Connect Wallet
            </CRTButton>
          )}
        </div>
      </header>

      {/* ASCII Banner */}
      <div className="ascii-banner ascii-banner--glow">
        <pre style={{ margin: 0, fontSize: '8px', lineHeight: 1.1 }}>{ASCII_LOGO}</pre>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          ══════════════════════════════════════════════════════════════════════════════
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
          <span>AUTONOMOUS DEFI YIELD AGENT</span>
          <span>TVL: ${metrics.totalValue.toLocaleString()} | APY: {metrics.avgAPY.toFixed(2)}%</span>
          <span>STATUS: {agentStatus.toUpperCase()}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="crt-container" style={{ padding: 'var(--space-6)' }}>

        {/* Agent Status */}
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <AgentStatus status={agentStatus} message={agentMessage} />
        </section>

        {/* Metrics Grid */}
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <div className="crt-grid crt-grid--4">
            <MetricCard
              label="Total Value Locked"
              value={`$${metrics.totalValue.toLocaleString()}`}
              change="+12.4%"
              changeType="positive"
            />
            <MetricCard
              label="Average APY"
              value={`${metrics.avgAPY.toFixed(2)}%`}
              variant="green"
            />
            <MetricCard
              label="Active Positions"
              value={metrics.activePositions.toString()}
              variant="white"
            />
            <MetricCard
              label="Risk Score"
              value={`${metrics.avgRisk.toFixed(1)}/10`}
              variant={metrics.avgRisk > 6 ? 'amber' : 'green'}
            />
          </div>
        </section>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>

          {/* Active Positions */}
          <TerminalWindow
            title="active_positions.log"
            status={`${metrics.activePositions} ACTIVE`}
            statusType="active"
          >
            <DataTable
              columns={[
                { key: 'protocol', label: 'Protocol' },
                { key: 'chain', label: 'Chain' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'apy', label: 'APY', align: 'right', render: (val) => (
                  <span style={{ color: 'var(--phosphor-green)' }}>{val}</span>
                )},
              ]}
              data={investments.slice(0, 5).map(inv => ({
                id: inv.id,
                protocol: inv.protocol_name || 'Unknown',
                chain: inv.blockchain?.toUpperCase() || 'ETH',
                amount: `$${Number(inv.amount || 0).toLocaleString()}`,
                apy: `${Number(inv.expected_apy || 0).toFixed(2)}%`,
              }))}
              emptyMessage="NO ACTIVE POSITIONS"
            />
          </TerminalWindow>

          {/* Top Opportunities */}
          <TerminalWindow
            title="opportunities.scan"
            status={`${opportunities.length} FOUND`}
            statusType={opportunities.length > 0 ? 'active' : 'warning'}
          >
            <DataTable
              columns={[
                { key: 'protocol', label: 'Protocol' },
                { key: 'apy', label: 'APY', align: 'right', render: (val) => (
                  <span style={{ color: 'var(--phosphor-green)', fontWeight: 600 }}>{val}</span>
                )},
                { key: 'tvl', label: 'TVL', align: 'right' },
                { key: 'risk', label: 'Risk', align: 'center', render: (val, row) => {
                  const riskNum = parseFloat(val);
                  const color = riskNum <= 4 ? 'var(--phosphor-green)' :
                               riskNum <= 6 ? 'var(--phosphor-amber)' :
                               'var(--status-error)';
                  return <span style={{ color }}>{val}</span>;
                }},
              ]}
              data={opportunities.slice(0, 5).map(opp => ({
                id: opp.id,
                protocol: opp.protocol_name || opp.protocol || 'Unknown',
                apy: `${Number(opp.apy || 0).toFixed(2)}%`,
                tvl: `$${(Number(opp.tvl || 0) / 1e6).toFixed(1)}M`,
                risk: `${Number(opp.risk_score || 5).toFixed(1)}`,
              }))}
              emptyMessage="RUN SCAN TO DISCOVER OPPORTUNITIES"
            />
          </TerminalWindow>
        </div>

        {/* Terminal Output */}
        <section style={{ marginTop: 'var(--space-6)' }}>
          <TerminalWindow title="system.log" status="LIVE" statusType="active">
            <div className="terminal-output" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {terminalLines.map((line, i) => (
                <div key={i} className="terminal-line" style={{
                  color: line.type === 'error' ? 'var(--status-error)' :
                         line.type === 'success' ? 'var(--phosphor-green)' :
                         line.type === 'command' ? 'var(--phosphor-amber)' :
                         'var(--text-secondary)'
                }}>
                  {line.text}
                </div>
              ))}
              <div className="terminal-line">
                <span style={{ color: 'var(--phosphor-amber)' }}>$</span>
                <span className="terminal-cursor" />
              </div>
            </div>
          </TerminalWindow>
        </section>

        {/* Action Buttons */}
        <section style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <CRTButton variant="primary" onClick={handleRunScan} disabled={loading}>
            {loading ? (
              <>
                <span className="ascii-spinner" style={{ marginRight: '8px' }} />
                SCANNING...
              </>
            ) : (
              'RUN SCAN'
            )}
          </CRTButton>
          <CRTButton onClick={() => navigate('/opportunities')}>
            VIEW ALL OPPORTUNITIES
          </CRTButton>
          <CRTButton onClick={() => navigate('/agent')}>
            AGENT TERMINAL
          </CRTButton>
          <CRTButton onClick={() => navigate('/settings')}>
            SETTINGS
          </CRTButton>
        </section>

        {/* Footer Stats */}
        <footer style={{
          marginTop: 'var(--space-8)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--crt-border)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)'
        }}>
          <span>NETWORKS: ETH • BASE</span>
          <span>PROTOCOLS: AAVE V3 • COMPOUND V3</span>
          <span>LAST SYNC: {new Date().toLocaleTimeString()}</span>
        </footer>
      </main>
    </div>
  );
}

export default RetroDashboard;
