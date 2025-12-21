"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroSettings } from "@/components/Cultiv8Agent/RetroSettings";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useAgentAuthorization } from "@/hooks/useAgentAuthorization";
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

  // Real on-chain authorization hook
  const {
    authorization,
    vaultBalance,
    usdcBalance,
    usdcAllowance,
    isLoading: authLoading,
    error: authError,
    isContractsDeployed,
    authorizeAgent,
    revokeAuthorization,
    updateLimits,
    approveUsdc,
    depositToVault,
    refresh: refreshAuth,
  } = useAgentAuthorization();

  // Transaction state
  const [txPending, setTxPending] = useState(false);
  const [txStatus, setTxStatus] = useState(null);

  // Sync authorization on-chain after transaction
  const syncAuthorizationToBackend = async (action, txHash, limits = {}) => {
    try {
      await fetch('/api/authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: walletAddress,
          chainId: 1, // Default to mainnet, should come from wallet
          transactionHash: txHash,
          action,
          maxAmountPerTx: limits.maxPerTx,
          dailyLimit: limits.dailyLimit,
        }),
      });
    } catch (error) {
      console.error('Failed to sync authorization to backend:', error);
    }
  };

  const handleAuthorize = async () => {
    if (!isConnected) {
      alert('Please connect wallet first');
      await connectWallet();
      return;
    }

    // Check if contracts are deployed
    if (!isContractsDeployed && !isDemoModeEnabled()) {
      alert(
        'Smart contracts are not yet deployed on this network.\n\n' +
        'Please switch to a supported network or wait for mainnet deployment.'
      );
      return;
    }

    // Prompt for spending limits
    const maxPerTxStr = prompt(
      'Enter maximum amount per transaction (USD):\n\n' +
      'This limits how much the agent can move in a single transaction.\n' +
      'Minimum: $100, Maximum: $100,000',
      '1000'
    );

    if (!maxPerTxStr) return;

    const maxPerTx = parseFloat(maxPerTxStr);
    if (isNaN(maxPerTx) || maxPerTx < 100 || maxPerTx > 100000) {
      alert('Invalid amount. Must be between $100 and $100,000');
      return;
    }

    const dailyLimitStr = prompt(
      'Enter daily spending limit (USD):\n\n' +
      'This limits total daily agent activity.\n' +
      'Must be >= max per transaction.',
      String(maxPerTx * 5)
    );

    if (!dailyLimitStr) return;

    const dailyLimit = parseFloat(dailyLimitStr);
    if (isNaN(dailyLimit) || dailyLimit < maxPerTx) {
      alert('Daily limit must be at least equal to max per transaction');
      return;
    }

    try {
      setTxPending(true);
      setTxStatus('Authorizing agent on-chain...');

      const result = await authorizeAgent(maxPerTx, dailyLimit);

      if (result.demo) {
        setTxStatus('Demo mode authorization successful');
        alert(
          '✅ Agent Authorized (Demo Mode)\n\n' +
          `Max per transaction: $${maxPerTx.toLocaleString()}\n` +
          `Daily limit: $${dailyLimit.toLocaleString()}\n\n` +
          'The agent can now scan and execute strategies.'
        );
      } else {
        // Sync to backend
        await syncAuthorizationToBackend('authorize', result.transactionHash, { maxPerTx, dailyLimit });

        setTxStatus('Authorization confirmed!');
        alert(
          '✅ Agent Authorized On-Chain!\n\n' +
          `Transaction: ${result.transactionHash.slice(0, 10)}...\n` +
          `Block: ${result.blockNumber}\n\n` +
          `Max per transaction: $${maxPerTx.toLocaleString()}\n` +
          `Daily limit: $${dailyLimit.toLocaleString()}\n\n` +
          'The agent can now execute strategies within your limits.'
        );
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      setTxStatus('Authorization failed');
      alert(`Authorization failed: ${error.message}`);
    } finally {
      setTxPending(false);
      setTimeout(() => setTxStatus(null), 3000);
    }
  };

  const handleUpdateLimits = async (limits) => {
    if (!authorization?.active) {
      alert('Please authorize the agent first');
      return;
    }

    try {
      setTxPending(true);
      setTxStatus('Updating spending limits...');

      const result = await updateLimits(limits.maxPerTx, limits.dailyLimit);

      if (result.demo) {
        alert(
          `Spending limits updated (Demo Mode):\n\n` +
          `Max per tx: $${limits.maxPerTx.toLocaleString()}\n` +
          `Daily limit: $${limits.dailyLimit.toLocaleString()}`
        );
      } else {
        await syncAuthorizationToBackend('update', result.transactionHash, limits);
        alert(
          `✅ Spending limits updated on-chain!\n\n` +
          `Transaction: ${result.transactionHash.slice(0, 10)}...\n` +
          `Max per tx: $${limits.maxPerTx.toLocaleString()}\n` +
          `Daily limit: $${limits.dailyLimit.toLocaleString()}`
        );
      }
    } catch (error) {
      alert(`Failed to update limits: ${error.message}`);
    } finally {
      setTxPending(false);
      setTxStatus(null);
    }
  };

  const handleRevoke = async () => {
    if (!authorization?.active) {
      alert('Agent is not currently authorized');
      return;
    }

    const confirmed = confirm(
      '⚠️ Revoke Agent Authorization?\n\n' +
      'This will immediately prevent the agent from executing any transactions.\n' +
      'You can re-authorize at any time.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      setTxPending(true);
      setTxStatus('Revoking authorization...');

      const result = await revokeAuthorization();

      if (result.demo) {
        alert('Authorization revoked (Demo Mode).\nAgent can no longer execute transactions.');
      } else {
        await syncAuthorizationToBackend('revoke', result.transactionHash);
        alert(
          '✅ Authorization Revoked\n\n' +
          `Transaction: ${result.transactionHash.slice(0, 10)}...\n\n` +
          'Agent can no longer execute transactions on your behalf.'
        );
      }
    } catch (error) {
      alert(`Failed to revoke: ${error.message}`);
    } finally {
      setTxPending(false);
      setTxStatus(null);
    }
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

  // Build authorization state for component
  const authorizationState = authorization ? {
    active: authorization.active,
    maxAmountPerTx: authorization.maxAmountPerTx * 1e6, // Convert back to internal format
    dailyLimit: authorization.dailyLimit * 1e6,
    dailySpent: authorization.dailySpent * 1e6,
    remainingDaily: authorization.remainingDaily,
    vaultBalance,
    usdcBalance,
    contractsDeployed: isContractsDeployed,
  } : {
    active: false,
    maxAmountPerTx: 0,
    dailyLimit: 0,
    dailySpent: 0,
    contractsDeployed: isContractsDeployed,
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
      isLoading={authLoading || txPending}
      txStatus={txStatus}
      authError={authError}
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
