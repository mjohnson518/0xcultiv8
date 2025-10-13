import { useState } from 'react';
import {
  RetroHeader,
  RetroCard,
  RetroButton,
  RetroModal,
} from '../Retro';
import { STATUS_ICONS } from '../../utils/asciiArt';
import { useDarkMode } from '../../hooks/useDarkMode';

/**
 * Retro Settings Page
 * Agent configuration and authorization management
 */
export function RetroSettings({
  config,
  authorization,
  walletAddress,
  isConnected,
  onConnect,
  onSaveConfig,
  onUpdateLimits,
  onRevoke,
}) {
  const [formData, setFormData] = useState({
    autoInvest: config?.auto_invest_enabled || false,
    maxPerOpp: config?.max_investment_per_opportunity || 1000,
    maxTotal: config?.max_total_investment || 10000,
    minAPY: config?.min_apy_threshold || 5.0,
    maxRisk: config?.max_risk_score || 7,
  });

  const [authLimits, setAuthLimits] = useState({
    maxPerTx: 1000,
    dailyLimit: 5000,
  });

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [isDark, toggleDark] = useDarkMode();

  const navigation = [
    { label: 'DASHBOARD', href: '/', active: false },
    { label: 'AGENT', href: '/agent', active: false },
    { label: 'OPPORTUNITIES', href: '/opportunities', active: false },
    { label: 'SETTINGS', href: '/settings', active: true },
  ];

  const handleSaveConfig = () => {
    if (onSaveConfig) {
      onSaveConfig(formData);
    }
  };

  const handleRevoke = () => {
    setShowRevokeModal(false);
    if (onRevoke) {
      onRevoke();
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
        currentPage="settings"
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      <div className="p-4 space-y-4">
        {/* Agent Configuration */}
        <RetroCard title="AGENT CONFIGURATION" status="SETTINGS">
          <div className="space-y-4 font-mono">
            {/* Auto-Invest Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">AUTO-INVEST:</span>
              <button
                onClick={() => setFormData(prev => ({ ...prev, autoInvest: !prev.autoInvest }))}
                className="font-mono text-sm px-3 py-1 border-2 border-retro-black bg-retro-bg text-retro-fg hover:bg-retro-gray-100"
              >
                {formData.autoInvest ? '[●ON]' : '[○OFF]'}
              </button>
            </div>

            {/* Max Investment Per Opportunity */}
            <div>
              <label className="block text-xs text-retro-gray-600 uppercase mb-1">
                Max Investment Per Opportunity:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.maxPerOpp}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPerOpp: Number(e.target.value) }))}
                  className="retro-input flex-1"
                  min="100"
                  max="100000"
                />
                <span className="text-sm">USD</span>
              </div>
            </div>

            {/* Max Total Investment */}
            <div>
              <label className="block text-xs text-retro-gray-600 uppercase mb-1">
                Max Total Investment:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.maxTotal}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxTotal: Number(e.target.value) }))}
                  className="retro-input flex-1"
                  min="100"
                  max="1000000"
                />
                <span className="text-sm">USD</span>
              </div>
            </div>

            {/* Min APY Threshold */}
            <div>
              <label className="block text-xs text-retro-gray-600 uppercase mb-1">
                Minimum APY Threshold:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={formData.minAPY}
                  onChange={(e) => setFormData(prev => ({ ...prev, minAPY: Number(e.target.value) }))}
                  className="retro-input flex-1"
                  min="0"
                  max="100"
                />
                <span className="text-sm">%</span>
              </div>
            </div>

            {/* Max Risk Score */}
            <div>
              <label className="block text-xs text-retro-gray-600 uppercase mb-1">
                Maximum Risk Score:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.maxRisk}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxRisk: Number(e.target.value) }))}
                  className="retro-input flex-1"
                  min="1"
                  max="10"
                />
                <span className="text-sm">(1-10)</span>
              </div>
              <p className="text-xs text-retro-gray-600 mt-1">
                Risk {formData.maxRisk}/10: {
                  formData.maxRisk < 4 ? 'CONSERVATIVE' :
                  formData.maxRisk < 7 ? 'BALANCED' : 'AGGRESSIVE'
                }
              </p>
            </div>

            {/* Save Button */}
            <RetroButton 
              variant="primary" 
              onClick={handleSaveConfig}
              className="w-full"
            >
              [✓ SAVE SETTINGS]
            </RetroButton>
          </div>
        </RetroCard>

        {/* Authorization Status */}
        <RetroCard 
          title="AUTHORIZATION STATUS" 
          status={authorization?.active ? 'AUTHORIZED' : 'NOT AUTHORIZED'}
          variant={authorization?.active ? 'default' : 'danger'}
        >
          {authorization?.active ? (
            <div className="font-mono text-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-retro-green">{STATUS_ICONS.active}</span>
                <span>AGENT AUTHORIZED</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Max Per Transaction</p>
                  <p className="font-semibold">${Number(authorization.maxAmountPerTx / 1e6).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Daily Limit</p>
                  <p className="font-semibold">${Number(authorization.dailyLimit / 1e6).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Daily Spent</p>
                  <p className="font-semibold">${Number(authorization.dailySpent / 1e6).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Remaining Today</p>
                  <p className="font-semibold text-retro-green">
                    ${Number((authorization.dailyLimit - authorization.dailySpent) / 1e6).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="border-t-2 border-retro-gray-300 pt-3">
                <p className="text-xs text-retro-gray-600 mb-1">Daily Usage:</p>
                <div className="font-mono">
                  {createPercentageBar(
                    Number(authorization.dailySpent),
                    Number(authorization.dailyLimit),
                    30
                  )}
                  {' '}
                  {Math.round((Number(authorization.dailySpent) / Number(authorization.dailyLimit)) * 100)}%
                </div>
              </div>

              {/* Update Limits Form */}
              <div className="border-t-2 border-retro-gray-300 pt-3 space-y-3">
                <p className="text-xs uppercase">Update Limits:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-retro-gray-600 mb-1">
                      Max Per TX:
                    </label>
                    <input
                      type="number"
                      value={authLimits.maxPerTx}
                      onChange={(e) => setAuthLimits(prev => ({ ...prev, maxPerTx: Number(e.target.value) }))}
                      className="retro-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-retro-gray-600 mb-1">
                      Daily Limit:
                    </label>
                    <input
                      type="number"
                      value={authLimits.dailyLimit}
                      onChange={(e) => setAuthLimits(prev => ({ ...prev, dailyLimit: Number(e.target.value) }))}
                      className="retro-input w-full text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <RetroButton 
                  onClick={() => onUpdateLimits && onUpdateLimits(authLimits)}
                  size="small"
                >
                  UPDATE LIMITS
                </RetroButton>
                <RetroButton 
                  variant="danger"
                  onClick={() => setShowRevokeModal(true)}
                  size="small"
                >
                  REVOKE
                </RetroButton>
              </div>
            </div>
          ) : (
            <div className="font-mono text-sm text-center py-6 space-y-3">
              <p className="text-retro-gray-600">
                {STATUS_ICONS.inactive} AGENT NOT AUTHORIZED
              </p>
              <p className="text-xs">
                Authorize the agent to enable autonomous yield farming
              </p>
              <RetroButton variant="primary">
                AUTHORIZE AGENT
              </RetroButton>
            </div>
          )}
        </RetroCard>

        {/* Risk Framework */}
        <RetroCard title="RISK FRAMEWORK" status="INFO" collapsible defaultExpanded={true}>
          <div className="font-mono text-sm space-y-4">
            <p className="text-retro-gray-600">
              Cultiv8 uses a multi-dimensional risk scoring system (0-10 scale):
            </p>

            {/* Risk Dimensions */}
            <div className="space-y-3 pl-3 border-l-2 border-retro-gray-400">
              <div>
                <p className="text-xs uppercase text-retro-gray-600 mb-1">Protocol Risk (25%)</p>
                <p className="text-xs">
                  Audit history, time in production, TVL track record, past exploits
                </p>
              </div>
              
              <div>
                <p className="text-xs uppercase text-retro-gray-600 mb-1">Financial Risk (25%)</p>
                <p className="text-xs">
                  Liquidity depth, impermanent loss potential, fee structure
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-retro-gray-600 mb-1">Technical Risk (25%)</p>
                <p className="text-xs">
                  Smart contract complexity, upgrade mechanisms, oracle dependencies
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-retro-gray-600 mb-1">Market Risk (25%)</p>
                <p className="text-xs">
                  Asset volatility, correlation risk, market conditions
                </p>
              </div>
            </div>

            {/* Risk Levels Guide */}
            <div className="border-t-2 border-retro-gray-300 pt-3 space-y-2">
              <p className="text-xs uppercase font-semibold">Risk Level Guide:</p>
              <div className="space-y-1 text-xs">
                <p><span className="text-retro-green">●</span> 0-3: LOW RISK - Blue-chip protocols, minimal complexity</p>
                <p><span className="text-retro-amber">●</span> 4-6: MEDIUM RISK - Established but with some complexity</p>
                <p><span className="text-retro-amber">●</span> 7-8: HIGH RISK - Newer protocols or higher complexity</p>
                <p><span className="text-retro-red">●</span> 9-10: CRITICAL RISK - Experimental, unaudited, or high volatility</p>
              </div>
            </div>

            {/* User Risk Preference */}
            <div className="border-t-2 border-retro-gray-300 pt-3">
              <p className="text-xs uppercase font-semibold mb-2">Your Risk Tolerance:</p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs">CONSERVATIVE</span>
                    <span className="text-xs">MODERATE</span>
                    <span className="text-xs">AGGRESSIVE</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.maxRisk}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxRisk: Number(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-retro-gray-600 mt-1">
                    <span>Risk 1</span>
                    <span className="font-semibold text-retro-fg">
                      Current: {formData.maxRisk}/10
                    </span>
                    <span>Risk 10</span>
                  </div>
                </div>
                <p className="text-xs text-retro-gray-600">
                  Agent will only select opportunities with risk score ≤ {formData.maxRisk}
                </p>
              </div>
            </div>
          </div>
        </RetroCard>

        {/* Advanced Settings */}
        <RetroCard title="ADVANCED OPTIONS" collapsible defaultExpanded={false}>
          <div className="font-mono text-sm space-y-3">
            <div className="flex items-center justify-between">
              <span>Scan Interval:</span>
              <select className="border-2 border-retro-black px-2 py-1 bg-retro-bg text-retro-fg font-mono">
                <option>1 HOUR</option>
                <option>6 HOURS</option>
                <option>24 HOURS</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Enable MCP Servers:</span>
              <button className="font-mono text-sm text-retro-fg">[●ON]</button>
            </div>

            <div className="flex items-center justify-between">
              <span>Emergency Pause:</span>
              <button className="font-mono text-sm text-retro-fg">[○OFF]</button>
            </div>
          </div>
        </RetroCard>
      </div>

      {/* Revoke Confirmation Modal */}
      <RetroModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="CONFIRM REVOCATION"
        variant="danger"
        footer={
          <>
            <RetroButton onClick={() => setShowRevokeModal(false)}>
              CANCEL
            </RetroButton>
            <RetroButton variant="danger" onClick={handleRevoke}>
              REVOKE NOW
            </RetroButton>
          </>
        }
      >
        <div className="terminal-bg p-4 font-mono text-sm">
          <p className="text-retro-red mb-2">⚠ WARNING</p>
          <p className="text-white">
            This will immediately revoke all agent permissions.
          </p>
          <p className="text-white mt-2">
            The agent will no longer be able to execute strategies on your behalf.
          </p>
          <p className="text-retro-amber mt-2">
            This action is reversible - you can re-authorize anytime.
          </p>
        </div>
      </RetroModal>
    </div>
  );
}

