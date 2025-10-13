import { useState } from 'react';
import {
  RetroHeader,
  RetroCard,
  RetroAgentTerminal,
  RetroButton,
  RetroLoader,
} from '../Retro';
import { STATUS_ICONS } from '../../utils/asciiArt';

/**
 * Retro Agent Page
 * Terminal-style agent execution interface
 */
export function RetroAgent({
  walletAddress,
  isConnected,
  onConnect,
  agentStatus,
  executionSteps,
  selectedStrategy,
  onRunAgent,
  onApprove,
  onReject,
}) {
  const [isRunning, setIsRunning] = useState(false);

  const navigation = [
    { label: 'DASHBOARD', href: '/', active: false },
    { label: 'AGENT', href: '/agent', active: true },
    { label: 'OPPORTUNITIES', href: '/opportunities', active: false },
    { label: 'SETTINGS', href: '/settings', active: false },
  ];

  const handleRunAgent = async () => {
    setIsRunning(true);
    if (onRunAgent) {
      await onRunAgent();
    }
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-retro-white">
      {/* Header */}
      <RetroHeader
        walletAddress={walletAddress}
        isConnected={isConnected}
        onConnect={onConnect}
        navigation={navigation}
        currentPage="agent"
      />

      <div className="p-4 space-y-4">
        {/* Agent Status */}
        <RetroCard 
          title="AGENT STATUS" 
          status={agentStatus?.operational ? 'OPERATIONAL' : 'PAUSED'}
        >
          <div className="font-mono text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span>{agentStatus?.operational ? STATUS_ICONS.active : STATUS_ICONS.inactive}</span>
              <span>Auto-Invest: {agentStatus?.autoInvestEnabled ? '[●ON]' : '[○OFF]'}</span>
            </div>
            <p>Last Execution: {agentStatus?.lastRun || 'Never'}</p>
            <p>Next Scan: {agentStatus?.nextScan || 'Not scheduled'}</p>
            <p>Pending Approvals: {agentStatus?.pendingApprovals || 0}</p>
          </div>
        </RetroCard>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2">
          <RetroButton 
            variant="primary" 
            onClick={handleRunAgent}
            disabled={isRunning || !isConnected}
          >
            {isRunning ? 'RUNNING...' : 'RUN AGENT'}
          </RetroButton>
          <RetroButton href="/settings">
            AGENT SETTINGS
          </RetroButton>
          <RetroButton>
            VIEW HISTORY
          </RetroButton>
        </div>

        {/* Execution Terminal */}
        <RetroAgentTerminal
          title="AGENT EXECUTION LOG"
          steps={executionSteps || []}
          maxHeight="500px"
          showPrompt={true}
          onClear={() => {}}
        />

        {/* Selected Strategy (if available) */}
        {selectedStrategy && (
          <RetroCard 
            title="SELECTED STRATEGY" 
            status={selectedStrategy.needsApproval ? 'APPROVAL REQUIRED' : 'READY'}
            variant={selectedStrategy.needsApproval ? 'warning' : 'default'}
          >
            <div className="font-mono text-sm space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Protocol</p>
                  <p className="font-semibold">{selectedStrategy.protocol?.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Chain</p>
                  <p className="font-semibold">{selectedStrategy.blockchain?.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Amount</p>
                  <p className="font-semibold text-retro-black">
                    ${Number(selectedStrategy.amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Expected APY</p>
                  <p className="font-semibold text-retro-green">
                    {Number(selectedStrategy.expectedAPY).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Risk Score</p>
                  <p className="font-semibold">
                    {Number(selectedStrategy.riskScore).toFixed(1)}/10
                  </p>
                </div>
                <div>
                  <p className="text-retro-gray-600 text-xs uppercase mb-1">Confidence</p>
                  <p className="font-semibold">
                    {Math.round(Number(selectedStrategy.confidence || 0.5) * 100)}%
                  </p>
                </div>
              </div>

              {/* Rationale */}
              {selectedStrategy.rationale && (
                <div className="border-t-2 border-retro-gray-300 pt-3 mt-3">
                  <p className="text-retro-gray-600 text-xs uppercase mb-2">Rationale</p>
                  <p className="whitespace-pre-wrap">{selectedStrategy.rationale}</p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedStrategy.needsApproval && (
                <div className="flex gap-2 mt-4">
                  <RetroButton 
                    variant="success" 
                    onClick={() => onApprove && onApprove(selectedStrategy)}
                  >
                    [✓ APPROVE]
                  </RetroButton>
                  <RetroButton 
                    variant="danger"
                    onClick={() => onReject && onReject(selectedStrategy)}
                  >
                    [✗ REJECT]
                  </RetroButton>
                </div>
              )}
            </div>
          </RetroCard>
        )}

        {/* Agent Reasoning (if steps available) */}
        {executionSteps && executionSteps.length > 0 && (
          <RetroCard title="REASONING CHAIN" collapsible defaultExpanded={false}>
            <div className="space-y-3 font-mono text-sm">
              {executionSteps.map((step, i) => (
                <div key={i} className="border-l-2 border-retro-gray-400 pl-3">
                  <p className="text-retro-gray-600 text-xs">
                    STEP {i + 1}: {step.step.toUpperCase()}
                  </p>
                  {step.model && (
                    <p className="text-xs text-retro-gray-500">
                      [{step.model.toUpperCase()}]
                    </p>
                  )}
                  <p className="mt-1">
                    {typeof step.output === 'string' 
                      ? step.output.substring(0, 200) 
                      : JSON.stringify(step.output).substring(0, 200)
                    }
                    {step.output?.length > 200 && '...'}
                  </p>
                </div>
              ))}
            </div>
          </RetroCard>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-retro-black p-3 font-mono text-sm">
            <p className="text-retro-gray-600">Total Scans</p>
            <p className="text-2xl font-pixel">{agentStatus?.totalScans || 0}</p>
          </div>
          <div className="border-2 border-retro-black p-3 font-mono text-sm">
            <p className="text-retro-gray-600">Successful Executions</p>
            <p className="text-2xl font-pixel text-retro-green">
              {agentStatus?.successfulExecutions || 0}
            </p>
          </div>
          <div className="border-2 border-retro-black p-3 font-mono text-sm">
            <p className="text-retro-gray-600">Success Rate</p>
            <p className="text-2xl font-pixel">
              {agentStatus?.successRate?.toFixed(0) || 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

