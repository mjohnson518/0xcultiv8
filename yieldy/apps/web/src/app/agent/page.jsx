"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroAgent } from "@/components/Cultiv8Agent/RetroAgent";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";

const queryClient = new QueryClient();

function AgentWrapper() {
  const {
    config,
    scanMutation,
  } = useCultiv8AgentData();

  return (
    <RetroAgent
      walletAddress={null}
      isConnected={false}
      onConnect={() => console.log('Connect wallet')}
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

