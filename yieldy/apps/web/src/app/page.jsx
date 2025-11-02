"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RetroDashboard } from "@/components/Cultiv8Agent/RetroDashboard";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";

// Create a client
const queryClient = new QueryClient();

import { useWallet } from './providers/WalletProvider';

function DashboardWrapper() {
  const {
    config,
    opportunities,
    investments,
    scanMutation,
  } = useCultiv8AgentData();
  
  const { walletAddress, isConnected, connectWallet } = useWallet();

  const handleRunScan = async () => {
    try {
      await scanMutation.mutateAsync({
        blockchain: 'both',
        forceRun: true,
        scanOnly: true
      });
      console.log('Scan completed successfully');
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scan failed: ' + error.message);
    }
  };

  return (
    <RetroDashboard
      config={config}
      opportunities={opportunities || []}
      investments={investments || []}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onRunScan={handleRunScan}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardWrapper />
    </QueryClientProvider>
  );
}
