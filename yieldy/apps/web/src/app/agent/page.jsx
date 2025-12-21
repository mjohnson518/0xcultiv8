"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroAgent } from "@/components/Cultiv8Agent/RetroAgent";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useWallet } from '../providers/WalletProvider';

const queryClient = new QueryClient();

function AgentWrapper() {
  const {
    config,
    scanMutation,
    agentHistory,
    historyLoading,
  } = useCultiv8AgentData();

  const { walletAddress, isConnected, connectWallet } = useWallet();
  const [showHistory, setShowHistory] = useState(false);

  const handleViewHistory = () => {
    if (agentHistory && agentHistory.length > 0) {
      // Format history for display
      const historyText = agentHistory
        .slice(0, 10) // Show last 10 entries
        .map((entry, i) => {
          const date = new Date(entry.created_at || entry.timestamp).toLocaleString();
          const outcome = entry.outcome || entry.status || 'unknown';
          const strategy = entry.selected_strategy?.protocol || entry.action || 'N/A';
          return `${i + 1}. [${date}] ${outcome.toUpperCase()} - ${strategy}`;
        })
        .join('\n');

      alert(`Agent Execution History (Last 10):\n\n${historyText || 'No history available'}`);
    } else {
      alert('No agent history available yet.\n\nRun the agent to generate execution history.');
    }
  };

  // Calculate stats from history
  const totalScans = agentHistory?.length || 0;
  const successfulExecutions = agentHistory?.filter(h =>
    h.outcome === 'success' || h.status === 'completed'
  ).length || 0;
  const successRate = totalScans > 0 ? (successfulExecutions / totalScans) * 100 : 0;

  // Get last run time
  const lastRunEntry = agentHistory?.[0];
  const lastRun = lastRunEntry?.created_at
    ? new Date(lastRunEntry.created_at).toLocaleString()
    : 'Never';

  return (
    <RetroAgent
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      agentStatus={{
        operational: config?.auto_invest_enabled || false,
        autoInvestEnabled: config?.auto_invest_enabled || false,
        lastRun,
        nextScan: config?.scan_interval_minutes
          ? `Every ${config.scan_interval_minutes} minutes`
          : 'Not scheduled',
        pendingApprovals: 0,
        totalScans,
        successfulExecutions,
        successRate,
      }}
      executionSteps={[]}
      selectedStrategy={null}
      onRunAgent={() => scanMutation.mutate({ blockchain: 'both', forceRun: true })}
      onViewHistory={handleViewHistory}
    />
  );
}

export default function AgentPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentWrapper />
    </QueryClientProvider>
  );
}

