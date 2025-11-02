"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroAgent } from "@/components/Cultiv8Agent/RetroAgent";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";

const queryClient = new QueryClient();

import { useWallet } from '../providers/WalletProvider';

function AgentWrapper() {
  const {
    config,
    scanMutation,
  } = useCultiv8AgentData();
  
  const { walletAddress, isConnected, connectWallet } = useWallet();

  return (
    <RetroAgent
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      agentStatus={{
        operational: config?.auto_invest_enabled || false,
        autoInvestEnabled: config?.auto_invest_enabled || false,
        lastRun: 'Never',
        nextScan: 'Not scheduled',
        pendingApprovals: 0,
        totalScans: 0,
        successfulExecutions: 0,
        successRate: 0,
      }}
      executionSteps={[]}
      selectedStrategy={null}
      onRunAgent={() => scanMutation.mutate({ blockchain: 'both' })}
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

