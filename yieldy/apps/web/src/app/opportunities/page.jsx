"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroOpportunities } from "@/components/Cultiv8Agent/RetroOpportunities";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useWallet } from '../providers/WalletProvider';

const queryClient = new QueryClient();

function OpportunitiesWrapper() {
  const {
    opportunities,
    handleRunScan,
  } = useCultiv8AgentData();
  
  const { walletAddress, isConnected, connectWallet } = useWallet();

  return (
    <RetroOpportunities
      opportunities={opportunities || []}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onInvest={(opp) => console.log('Invest in:', opp)}
      onRefresh={() => handleRunScan('both')}
      loading={false}
    />
  );
}

export default function OpportunitiesPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <OpportunitiesWrapper />
    </QueryClientProvider>
  );
}

