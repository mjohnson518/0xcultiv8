import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { 
  RetroHeader, 
  RetroCard, 
  RetroCardGrid,
  RetroTable, 
  RetroButton,
  RetroLoader
} from '../Retro';
import { BANNERS, STATUS_ICONS, RISK_LEVELS } from '../../utils/asciiArt';
import { useDarkMode } from '../../hooks/useDarkMode';

/**
 * Retro Dashboard Page
 * Terminal-inspired main dashboard with metrics and data tables
 */
export function RetroDashboard({ 
  config,
  opportunities,
  investments,
  walletAddress,
  isConnected,
  onConnect,
  onRunScan,
}) {
  const [loading, setLoading] = useState(false);
  const [isDark, toggleDark] = useDarkMode();
  const navigate = useNavigate();

  // Calculate metrics
  const totalValue = investments?.reduce((sum, inv) => sum + Number(inv.amount || 0), 0) || 0;
  const avgAPY = investments?.length > 0
    ? investments.reduce((sum, inv) => sum + Number(inv.expected_apy || 0), 0) / investments.length
    : 0;
  const activePositions = investments?.filter(i => i.status === 'confirmed' || i.status === 'pending').length || 0;
  const avgRisk = investments?.length > 0
    ? investments.reduce((sum, inv) => sum + Number(inv.risk_score || 5), 0) / investments.length
    : 5;

  const navigation = [
    { label: 'DASHBOARD', href: '/', active: true },
    { label: 'AGENT', href: '/agent', active: false },
    { label: 'OPPORTUNITIES', href: '/opportunities', active: false },
    { label: 'SETTINGS', href: '/settings', active: false },
  ];

  const handleRunScan = async () => {
    setLoading(true);
    try {
      if (onRunScan) {
        await onRunScan();
      } else {
        // Trigger agent scan via API
        const response = await fetch('/api/agent/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            blockchain: 'both', 
            scanOnly: true,  // Just scan, don't auto-invest
            forceRun: true 
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Scan result:', data);
          // Navigate to agent page to see results
          navigate('/agent');
        } else {
          console.error('Scan failed:', await response.text());
          alert('Scan failed. Check console for details.');
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      alert('Scan error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-retro-bg text-retro-fg">
      {/* Header */}
      <RetroHeader
        walletAddress={walletAddress}
        isConnected={isConnected}
        onConnect={onConnect}
        navigation={navigation}
        currentPage="dashboard"
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      {/* System Status Banner */}
      <div className="terminal-bg p-4 font-mono text-xs overflow-x-auto">
        <pre className="text-retro-green">
{BANNERS.startup(totalValue.toLocaleString(), avgAPY.toFixed(2))}
        </pre>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        
        {/* Metrics Grid */}
        <RetroCardGrid cols={4}>
          <RetroCard title="TOTAL VALUE" status="LIVE">
            <div className="font-pixel text-4xl text-retro-fg">
              ${totalValue.toLocaleString()}
            </div>
            <div className="font-mono text-sm text-retro-gray-600 mt-2">
              INVESTED CAPITAL
            </div>
          </RetroCard>

          <RetroCard title="AVG APY" status="CURRENT">
            <div className="font-pixel text-4xl text-retro-green">
              {avgAPY.toFixed(2)}%
            </div>
            <div className="font-mono text-sm text-retro-gray-600 mt-2">
              ANNUAL YIELD
            </div>
          </RetroCard>

          <RetroCard title="POSITIONS" status="ACTIVE">
            <div className="font-pixel text-4xl text-retro-fg">
              {activePositions}
            </div>
            <div className="font-mono text-sm text-retro-gray-600 mt-2">
              PROTOCOLS
            </div>
          </RetroCard>

          <RetroCard title="AVG RISK" status={avgRisk < 4 ? 'LOW' : avgRisk < 7 ? 'MEDIUM' : 'HIGH'}>
            <div className="font-pixel text-4xl text-retro-fg">
              {avgRisk.toFixed(1)}/10
            </div>
            <div className="font-mono text-sm text-retro-gray-600 mt-2">
              RISK SCORE
            </div>
          </RetroCard>
        </RetroCardGrid>

        {/* Active Positions */}
        <RetroCard 
          title="ACTIVE POSITIONS" 
          status={`${activePositions} ITEMS`}
          footer="Last updated: Just now"
        >
          {loading ? (
            <div className="py-8 flex justify-center">
              <RetroLoader message="LOADING POSITIONS..." />
            </div>
          ) : investments && investments.length > 0 ? (
            <RetroTable
              columns={[
                { key: 'protocol', label: 'PROTOCOL', sortable: true },
                { key: 'blockchain', label: 'CHAIN', sortable: true },
                { key: 'amount', label: 'AMOUNT', align: 'right', sortable: true },
                { key: 'expected_apy', label: 'APY', align: 'right', sortable: true },
                { key: 'status', label: 'STATUS', align: 'center' },
              ]}
              data={investments.map(inv => ({
                id: inv.id,
                protocol: inv.protocol_name || 'Unknown',
                blockchain: inv.blockchain?.toUpperCase() || 'ETH',
                amount: `$${Number(inv.amount || 0).toLocaleString()}`,
                expected_apy: `${Number(inv.expected_apy || 0).toFixed(2)}%`,
                status: inv.status === 'confirmed' ? STATUS_ICONS.success : STATUS_ICONS.pending,
              }))}
            />
          ) : (
            <div className="py-8 text-center font-mono text-retro-gray-600">
              <p>NO ACTIVE POSITIONS</p>
              <p className="text-sm mt-2">Fund agent and run scan to begin</p>
            </div>
          )}
        </RetroCard>

        {/* Top Opportunities */}
        <RetroCard 
          title="TOP OPPORTUNITIES" 
          status={`${opportunities?.length || 0} AVAILABLE`}
          footer="Updated every 5 minutes"
        >
          {opportunities && opportunities.length > 0 ? (
            <RetroTable
              columns={[
                { key: 'protocol', label: 'PROTOCOL', sortable: true },
                { key: 'apy', label: 'APY', align: 'right', sortable: true },
                { key: 'tvl', label: 'TVL', align: 'right', sortable: true },
                { key: 'risk', label: 'RISK', align: 'center', sortable: true },
              ]}
              data={opportunities.slice(0, 5).map(opp => ({
                id: opp.id,
                protocol: opp.protocol_name || 'Unknown',
                apy: `${Number(opp.apy || 0).toFixed(2)}%`,
                tvl: `$${(Number(opp.tvl || 0) / 1e6).toFixed(1)}M`,
                risk: `${Number(opp.risk_score || 5)}/10`,
              }))}
            />
          ) : (
            <div className="py-4 text-center font-mono text-retro-gray-600">
              NO OPPORTUNITIES FOUND
            </div>
          )}
        </RetroCard>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <RetroButton 
            variant="primary" 
            onClick={handleRunScan}
            disabled={loading}
          >
            {loading ? 'SCANNING...' : 'RUN SCAN'}
          </RetroButton>
          <RetroButton onClick={() => navigate('/opportunities')}>
            VIEW ALL OPPORTUNITIES
          </RetroButton>
          <RetroButton onClick={() => navigate('/settings')}>
            AGENT SETTINGS
          </RetroButton>
        </div>
      </div>
    </div>
  );
}

