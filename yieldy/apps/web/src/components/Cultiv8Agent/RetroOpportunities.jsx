import { useState } from 'react';
import {
  RetroHeader,
  RetroCard,
  RetroTable,
  RetroButton,
  RetroLoader,
} from '../Retro';
import { RISK_LEVELS, STATUS_ICONS, createPercentageBar } from '../../utils/asciiArt';
import { useDarkMode } from '../../hooks/useDarkMode';

/**
 * Retro Opportunities Page
 * Protocol opportunity discovery with sortable table
 */
export function RetroOpportunities({
  opportunities = [],
  walletAddress,
  isConnected,
  onConnect,
  onInvest,
  onRefresh,
  loading = false,
}) {
  const [selected, setSelected] = useState(null);
  const [filterChain, setFilterChain] = useState('all');
  const [isDark, toggleDark] = useDarkMode();

  const navigation = [
    { label: 'DASHBOARD', href: '/', active: false },
    { label: 'AGENT', href: '/agent', active: false },
    { label: 'OPPORTUNITIES', href: '/opportunities', active: true },
    { label: 'SETTINGS', href: '/settings', active: false },
  ];

  // Filter opportunities by chain
  const filteredOpportunities = filterChain === 'all'
    ? opportunities
    : opportunities.filter(o => o.blockchain === filterChain);

  const getRiskLevel = (score) => {
    if (score < 3) return { text: RISK_LEVELS.low, color: 'text-retro-green' };
    if (score < 5) return { text: RISK_LEVELS.medium, color: 'text-retro-amber' };
    if (score < 7) return { text: RISK_LEVELS.high, color: 'text-retro-amber' };
    return { text: RISK_LEVELS.veryHigh, color: 'text-retro-red' };
  };

  return (
    <div className="min-h-screen bg-retro-bg text-retro-fg">
      {/* Header */}
      <RetroHeader
        walletAddress={walletAddress}
        isConnected={isConnected}
        onConnect={onConnect}
        navigation={navigation}
        currentPage="opportunities"
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="p-4 space-y-4">
        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-sm">
            <span>FILTER:</span>
            <select
              value={filterChain}
              onChange={(e) => setFilterChain(e.target.value)}
              className="border-2 border-retro-black px-2 py-1 bg-retro-bg text-retro-fg font-mono"
            >
              <option value="all">ALL CHAINS</option>
              <option value="ethereum">ETHEREUM</option>
              <option value="base">BASE</option>
            </select>
          </div>
          <RetroButton 
            size="small" 
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? STATUS_ICONS.loading : '↻'} REFRESH
          </RetroButton>
        </div>

        {/* Opportunities Table */}
        <RetroCard
          title="PROTOCOL OPPORTUNITIES"
          status={`${filteredOpportunities.length} AVAILABLE`}
          footer={`Showing ${filterChain === 'all' ? 'all chains' : filterChain.toUpperCase()}`}
        >
          {loading ? (
            <div className="py-12 flex justify-center">
              <RetroLoader message="SCANNING PROTOCOLS..." variant="terminal" />
            </div>
          ) : filteredOpportunities.length > 0 ? (
            <RetroTable
              columns={[
                { key: 'protocol', label: 'PROTOCOL', sortable: true },
                { key: 'chain', label: 'CHAIN', sortable: true },
                { key: 'apy', label: 'APY', align: 'right', sortable: true },
                { key: 'tvl', label: 'TVL', align: 'right', sortable: true },
                { key: 'risk', label: 'RISK', align: 'center', sortable: true },
              ]}
              data={filteredOpportunities.map(opp => ({
                id: opp.id,
                protocol: opp.protocol_name || 'Unknown',
                chain: opp.blockchain?.toUpperCase() || 'ETH',
                apy: `${Number(opp.apy || 0).toFixed(2)}%`,
                tvl: `$${(Number(opp.tvl || 0) / 1e6).toFixed(1)}M`,
                risk: `${Number(opp.risk_score || 5)}/10`,
                _raw: opp, // Keep original for selection
              }))}
              onRowClick={(row) => setSelected(row._raw)}
            />
          ) : (
            <div className="py-8 text-center font-mono text-retro-gray-600">
              <p>NO OPPORTUNITIES FOUND</p>
              <p className="text-sm mt-2">Try running an agent scan</p>
            </div>
          )}
        </RetroCard>

        {/* Selected Protocol Details */}
        {selected && (
          <RetroCard
            title={`SELECTED: ${selected.protocol_name?.toUpperCase()} (${selected.blockchain?.toUpperCase()})`}
            variant="terminal"
          >
            <div className="font-mono text-sm space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-retro-green text-xs mb-1">APY</p>
                  <p className="text-xl font-pixel text-white">
                    {Number(selected.apy).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-retro-green text-xs mb-1">TVL</p>
                  <p className="text-xl font-pixel text-white">
                    ${(Number(selected.tvl) / 1e9).toFixed(2)}B
                  </p>
                </div>
                <div>
                  <p className="text-retro-green text-xs mb-1">RISK SCORE</p>
                  <p className="text-xl font-pixel text-white">
                    {Number(selected.risk_score).toFixed(1)}/10
                  </p>
                </div>
                <div>
                  <p className="text-retro-green text-xs mb-1">MIN DEPOSIT</p>
                  <p className="text-xl font-pixel text-white">
                    ${Number(selected.minimum_deposit || 1)}
                  </p>
                </div>
              </div>

              {/* Risk Breakdown */}
              {selected.risk_breakdown && (
                <div className="border-t border-retro-gray-700 pt-3">
                  <p className="text-retro-green mb-2">RISK BREAKDOWN:</p>
                  <div className="space-y-1 text-white">
                    <p>Protocol: {getRiskLevel(selected.risk_breakdown.protocol).text}</p>
                    <p>Financial: {getRiskLevel(selected.risk_breakdown.financial).text}</p>
                    <p>Technical: {getRiskLevel(selected.risk_breakdown.technical).text}</p>
                    <p>Market: {getRiskLevel(selected.risk_breakdown.market).text}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <RetroButton 
                  variant="success"
                  onClick={() => onInvest && onInvest(selected)}
                  disabled={!isConnected}
                >
                  [$ INVEST NOW]
                </RetroButton>
                <RetroButton onClick={() => setSelected(null)}>
                  [× CLOSE]
                </RetroButton>
              </div>
            </div>
          </RetroCard>
        )}
      </div>
    </div>
  );
}

