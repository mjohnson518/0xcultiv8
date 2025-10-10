'use client';

import { useState } from 'react';
import { Shield, AlertCircle, CheckCircle, Infinity } from 'lucide-react';

/**
 * Agent Authorization Component
 * Allows users to authorize the Cultiv8 agent with EIP-8004 compliant limits
 */
export function AgentAuthorization({ onAuthorized }) {
  const [maxPerTx, setMaxPerTx] = useState('1000');
  const [dailyLimit, setDailyLimit] = useState('5000');
  const [understood, setUnderstood] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleAuthorize = async () => {
    if (!understood) {
      alert('Please confirm you understand the risks');
      return;
    }

    setIsAuthorizing(true);

    try {
      // TODO: Integration with wagmi/viem for actual blockchain interaction
      // For now, simulate authorization
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsAuthorized(true);
      if (onAuthorized) {
        onAuthorized({ maxPerTx, dailyLimit });
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      alert('Authorization failed. Please try again.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  if (isAuthorized) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Agent Authorized!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The Cultiv8 AI agent can now execute yield strategies on your behalf
            within your specified limits.
          </p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg text-sm text-left border border-emerald-200 dark:border-emerald-800">
            <p className="font-semibold mb-2 text-emerald-900 dark:text-emerald-300">Your Authorization:</p>
            <p className="text-gray-700 dark:text-gray-300">Max per transaction: ${maxPerTx}</p>
            <p className="text-gray-700 dark:text-gray-300">Daily limit: ${dailyLimit}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              You can revoke or update these limits anytime in Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3 mb-4">
        <div className="relative">
          <Shield className="w-6 h-6 text-emerald-600" />
          <Infinity className="w-3 h-3 text-emerald-600 absolute -top-1 -right-1" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Authorize Cultiv8 Agent
        </h3>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="text-sm text-emerald-900 dark:text-emerald-100">
            <p className="font-semibold mb-1">EIP-7702 & EIP-8004 Compliant</p>
            <p className="text-emerald-800 dark:text-emerald-200">
              Cultiv8 uses the latest Ethereum standards for trustless agent authorization.
              You maintain full control and can revoke access instantly.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Maximum Amount Per Transaction
          </label>
          <div className="relative">
            <input
              type="number"
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="1000"
              min="100"
              max="1000000"
            />
            <span className="absolute right-3 top-2 text-gray-500 dark:text-gray-400">USDC</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Maximum the agent can invest in a single transaction
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Daily Spending Limit
          </label>
          <div className="relative">
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="5000"
              min={maxPerTx}
              max="1000000"
            />
            <span className="absolute right-3 top-2 text-gray-500 dark:text-gray-400">USDC</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Maximum the agent can invest across all transactions per day
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                Important Security Notice
              </p>
              <ul className="text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                <li>The agent can only execute within your specified limits</li>
                <li>All executions are recorded on-chain for transparency</li>
                <li>You can revoke authorization instantly at any time</li>
                <li>Agent can only interact with whitelisted protocols</li>
                <li>Your private keys remain under your control</li>
              </ul>
            </div>
          </div>
        </div>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I understand the risks and authorize the agent to execute strategies within these limits
          </span>
        </label>

        <button
          onClick={handleAuthorize}
          disabled={!understood || isAuthorizing}
          className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isAuthorizing ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Authorizing...</span>
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              <span>Authorize Agent (EIP-8004)</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Technical Details:</strong> This authorization creates an EIP-8004 compliant
          on-chain record that allows the Cultiv8 agent to execute strategies via EIP-7702
          temporary code delegation. Your EOA remains in your control at all times.
        </p>
      </div>
    </div>
  );
}

