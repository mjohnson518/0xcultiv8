"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RetroDashboard } from "@/components/Cultiv8Agent/RetroDashboard";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";

// Create a client
const queryClient = new QueryClient();

function DashboardWrapper() {
  const {
    config,
    opportunities,
    investments,
    scanMutation,
  } = useCultiv8AgentData();

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
      walletAddress={null}
      isConnected={false}
      onConnect={() => console.log('Connect wallet')}
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
