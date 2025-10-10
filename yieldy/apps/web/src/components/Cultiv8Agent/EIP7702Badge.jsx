'use client';

import { Shield, Sparkles } from 'lucide-react';

/**
 * EIP-7702/8004 Compliance Badge
 * Displays prominently to communicate competitive advantage
 */
export function EIP7702Badge() {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <div className="relative">
            <Shield className="w-8 h-8 text-emerald-600" />
            <Sparkles className="w-4 h-4 text-blue-600 absolute -top-1 -right-1" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
              EIP-7702
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              EIP-8004
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            World's First Compliant Yield Agent
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Trustless automation with on-chain limits and instant revocation
          </p>
        </div>
      </div>
    </div>
  );
}

