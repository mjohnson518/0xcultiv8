"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroSettings } from "@/components/Cultiv8Agent/RetroSettings";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";

const queryClient = new QueryClient();

function SettingsWrapper() {
  const {
    config,
    updateConfigMutation,
  } = useCultiv8AgentData();

  return (
    <RetroSettings
      config={config}
      authorization={{
        active: false,
        maxAmountPerTx: 1000000000, // $1000 in USDC decimals
        dailyLimit: 5000000000, // $5000
        dailySpent: 0,
      }}
      walletAddress={null}
      isConnected={false}
      onConnect={() => console.log('Connect wallet')}
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

