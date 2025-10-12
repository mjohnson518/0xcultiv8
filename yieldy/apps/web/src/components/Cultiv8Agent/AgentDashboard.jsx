'use client';

import { useState } from 'react';
import { Brain, Play, Pause, History, BarChart3 } from 'lucide-react';
import { ReasoningChain } from './ReasoningChain';

/**
 * Agent Dashboard Component
 * Main interface for running and monitoring the AI agent
 */
export function AgentDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRunAgent = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'autonomous' }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Agent execution failed');
        setIsRunning(false);
        return;
      }

      setAgentResult(result);
      setIsRunning(false);
    } catch (err) {
      setError('Failed to run agent: ' + err.message);
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Agent Control</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                LangGraph-powered multi-step reasoning
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors font-medium"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Agent Running...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Run Agent</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Agent Result */}
      {agentResult && (
        <>
          {/* Selected Strategy */}
          {agentResult.strategy && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Selected Strategy</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Protocol</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {agentResult.strategy.protocol}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Amount</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${agentResult.strategy.amount?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Expected APY</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {agentResult.strategy.expectedAPY}%
                  </p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Risk Score</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {agentResult.strategy.riskScore}/10
                  </p>
                </div>
              </div>

              {agentResult.needsApproval && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                    Human approval required for this strategy
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    Strategy exceeds risk tolerance or uses significant portion of funds
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reasoning Chain */}
          {agentResult.reasoning && agentResult.reasoning.length > 0 && (
            <ReasoningChain steps={agentResult.reasoning} />
          )}

          {/* Errors */}
          {agentResult.errors && agentResult.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">Errors Detected</h4>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                {agentResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

