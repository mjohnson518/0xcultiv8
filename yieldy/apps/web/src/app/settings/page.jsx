"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroSettings } from "@/components/Cultiv8Agent/RetroSettings";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useWallet } from '../providers/WalletProvider';

const queryClient = new QueryClient();

function SettingsWrapper() {
  const {
    config,
    updateConfigMutation,
  } = useCultiv8AgentData();
  
  const { walletAddress, isConnected, connectWallet } = useWallet();

  return (
    <RetroSettings
      config={config}
      authorization={{
        active: isConnected,
        maxAmountPerTx: 1000000000, // $1000 in USDC decimals
        dailyLimit: 5000000000, // $5000
        dailySpent: 0,
      }}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onSaveConfig={(data) => updateConfigMutation.mutate(data)}
      onUpdateLimits={(limits) => console.log('Update limits:', limits)}
      onRevoke={() => console.log('Revoke authorization')}
    />
  );
}

export default function SettingsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsWrapper />
    </QueryClientProvider>
  );
}

