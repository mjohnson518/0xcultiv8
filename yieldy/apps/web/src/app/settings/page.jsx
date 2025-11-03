"use client";

import { useState } from "react";
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
  
  // Demo authorization state (in real app, this would check smart contract)
  const [authorizationState, setAuthorizationState] = useState({
    active: false,
    maxAmountPerTx: 1000000000,
    dailyLimit: 5000000000,
    dailySpent: 0,
  });

  const handleAuthorize = async () => {
    if (!isConnected) {
      alert('Please connect wallet first');
      await connectWallet();
      return;
    }

    // Demo mode: simulate authorization
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      setAuthorizationState({
        ...authorizationState,
        active: true,
      });
      alert('✅ Agent Authorized in Demo Mode!\n\nSpending limits set:\n• Max per transaction: $1,000\n• Daily limit: $5,000\n\nThe agent can now scan for opportunities.');
    } else {
      // Real mode: would call EIP-7702 smart contract
      alert('Smart contract authorization not yet implemented.\nComing soon: EIP-7702 on-chain authorization');
    }
  };

  const handleUpdateLimits = (limits) => {
    setAuthorizationState({
      ...authorizationState,
      maxAmountPerTx: limits.maxPerTx * 1000000, // Convert to USDC decimals
      dailyLimit: limits.dailyLimit * 1000000,
    });
    alert(`Spending limits updated:\n• Max per tx: $${limits.maxPerTx.toLocaleString()}\n• Daily limit: $${limits.dailyLimit.toLocaleString()}`);
  };

  const handleRevoke = () => {
    setAuthorizationState({
      ...authorizationState,
      active: false,
      dailySpent: 0,
    });
    alert('Authorization revoked. Agent can no longer execute transactions.');
  };

  return (
    <RetroSettings
      config={config}
      authorization={authorizationState}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onSaveConfig={(data) => updateConfigMutation.mutate(data)}
      onUpdateLimits={handleUpdateLimits}
      onRevoke={handleRevoke}
      onAuthorize={handleAuthorize}
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

