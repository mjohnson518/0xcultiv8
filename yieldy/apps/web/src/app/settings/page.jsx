"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroSettings } from "@/components/Cultiv8Agent/RetroSettings";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useWallet } from '../providers/WalletProvider';
import { isDemoModeEnabled } from '@/utils/demoMode';

const queryClient = new QueryClient();

function SettingsWrapper() {
  const {
    config,
    updateConfigMutation,
    upgradeTierMutation,
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

    // Demo mode: simulate authorization (only if safely enabled)
    if (isDemoModeEnabled()) {
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

  const handleUpgradeTier = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      await connectWallet();
      return;
    }

    try {
      const result = await upgradeTierMutation.mutateAsync();
      if (result.upgraded) {
        alert(
          `Tier upgraded successfully!\n\n` +
          `New tier: ${result.newTier?.toUpperCase() || 'Unknown'}\n` +
          `Previous tier: ${result.previousTier?.toUpperCase() || 'Unknown'}`
        );
      } else {
        alert(
          `Tier upgrade not available.\n\n` +
          `Current tier: ${result.currentTier?.toUpperCase() || config?.user_tier?.toUpperCase() || 'Community'}\n` +
          `Reason: ${result.reason || 'You may not be eligible for an upgrade yet.'}`
        );
      }
    } catch (error) {
      alert(`Tier upgrade failed: ${error.message}`);
    }
  };

  // Form validation for config save
  const handleSaveConfig = (data) => {
    // Validate that maxTotal >= maxPerOpp
    if (data.maxTotal < data.maxPerOpp) {
      alert('Max Total Investment must be greater than or equal to Max Per Opportunity');
      return;
    }

    // Validate ranges
    if (data.maxPerOpp < 100 || data.maxPerOpp > 100000) {
      alert('Max Per Opportunity must be between $100 and $100,000');
      return;
    }

    if (data.maxTotal < 100 || data.maxTotal > 1000000) {
      alert('Max Total Investment must be between $100 and $1,000,000');
      return;
    }

    if (data.minAPY < 0 || data.minAPY > 100) {
      alert('Minimum APY must be between 0% and 100%');
      return;
    }

    if (data.maxRisk < 1 || data.maxRisk > 10) {
      alert('Max Risk Score must be between 1 and 10');
      return;
    }

    // All validations passed, save config
    updateConfigMutation.mutate({
      max_investment_per_opportunity: data.maxPerOpp,
      max_total_investment: data.maxTotal,
      min_apy_threshold: data.minAPY,
      max_risk_score: data.maxRisk,
      auto_invest_enabled: data.autoInvest,
    });

    alert('Settings saved successfully!');
  };

  return (
    <RetroSettings
      config={config}
      authorization={authorizationState}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onSaveConfig={handleSaveConfig}
      onUpdateLimits={handleUpdateLimits}
      onRevoke={handleRevoke}
      onAuthorize={handleAuthorize}
      onUpgradeTier={handleUpgradeTier}
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

