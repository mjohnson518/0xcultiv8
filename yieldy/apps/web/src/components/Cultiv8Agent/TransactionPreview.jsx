'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Zap, Shield, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Transaction Preview Component
 * Shows simulation results, gas costs, MEV risk before execution
 */
export function TransactionPreview({ strategy, onConfirm, onCancel }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      const response = await fetch('/api/execute/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strategy),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Simulation failed');
        setLoading(false);
        return;
      }

      setPreview(data.preview);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch preview');
      setLoading(false);
    }
  };

  const getMEVColor = (level) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
      case 'MEDIUM':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300';
      default:
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300';
    }
  };

  const getActionIcon = (action) => {
    return action === 'deposit' ? (
      <TrendingUp className="w-5 h-5 text-emerald-600" />
    ) : (
      <TrendingDown className="w-5 h-5 text-blue-600" />
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Simulating transaction...</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Verifying on-chain compatibility
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-red-200 dark:border-red-800">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Simulation Failed</h3>
        </div>
        <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3 mb-6">
        {getActionIcon(preview.action)}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction Preview</h3>
      </div>

      {/* Strategy Details */}
      <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Protocol</span>
          <span className="font-medium text-gray-900 dark:text-white capitalize">{preview.protocol}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Chain</span>
          <span className="font-medium text-gray-900 dark:text-white capitalize">{preview.chain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Action</span>
          <span className="font-medium text-gray-900 dark:text-white capitalize">{preview.action}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Amount</span>
          <span className="font-medium text-gray-900 dark:text-white">${preview.amount.toLocaleString()} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Est. Gas Cost</span>
          <span className="font-medium text-gray-900 dark:text-white">${preview.totalGasCost}</span>
        </div>
        {preview.action === 'withdraw' && (
          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Net Amount</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ${preview.netReturn}
            </span>
          </div>
        )}
      </div>

      {/* Transaction Steps */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Transaction Steps</h4>
        <div className="space-y-2">
          {preview.transactions.map((tx, i) => (
            <div key={i} className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Est. gas: ~${tx.estimatedCost}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MEV Risk Assessment */}
      <div className={`p-4 rounded-lg mb-6 border ${getMEVColor(preview.mevRisk.level)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span className="font-medium">MEV Risk: {preview.mevRisk.level}</span>
          </div>
          <span className="text-sm font-semibold">{preview.mevRisk.score}/10</span>
        </div>
        {preview.mevRisk.recommendations.length > 0 && (
          <ul className="text-sm list-disc list-inside space-y-1 mt-2">
            {preview.mevRisk.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Simulation Result */}
      {preview.willSucceed ? (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-lg mb-6">
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Transaction simulated successfully</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            All checks passed - transaction will succeed on-chain
          </p>
        </div>
      ) : (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-6">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Transaction would fail - do not proceed</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(preview)}
          disabled={!preview.willSucceed}
          className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2 transition-colors"
        >
          <Zap className="w-4 h-4" />
          <span>Execute {preview.action}</span>
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
        Transaction will be executed via EIP-7702 delegation within your authorized limits
      </p>
    </div>
  );
}

