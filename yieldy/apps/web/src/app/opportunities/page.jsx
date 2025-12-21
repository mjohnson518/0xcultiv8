"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetroOpportunities } from "@/components/Cultiv8Agent/RetroOpportunities";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { useWallet } from '../providers/WalletProvider';

const queryClient = new QueryClient();

function OpportunitiesWrapper() {
  const {
    opportunities,
    opportunitiesLoading,
    handleRunScan,
    handleInvest,
    scanMutation,
  } = useCultiv8AgentData();

  const { walletAddress, isConnected, connectWallet } = useWallet();
  const [isInvesting, setIsInvesting] = useState(false);

  const onInvest = async (opportunity) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      await connectWallet();
      return;
    }

    // Prompt for investment amount
    const amountStr = prompt(
      `Enter investment amount for ${opportunity.protocol_name} (USD):\n\n` +
      `APY: ${Number(opportunity.apy).toFixed(2)}%\n` +
      `Risk: ${opportunity.risk_score}/10\n` +
      `Min: $${opportunity.minimum_deposit || 1}`
    );

    if (!amountStr) return; // User cancelled

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount');
      return;
    }

    if (opportunity.minimum_deposit && amount < opportunity.minimum_deposit) {
      alert(`Minimum deposit is $${opportunity.minimum_deposit}`);
      return;
    }

    setIsInvesting(true);
    try {
      const result = await handleInvest(opportunity, amount);
      alert(
        `Investment successful!\n\n` +
        `Amount: $${amount.toLocaleString()}\n` +
        `Protocol: ${opportunity.protocol_name}\n` +
        `Expected APY: ${Number(opportunity.apy).toFixed(2)}%`
      );
    } catch (error) {
      alert(`Investment failed: ${error.message}`);
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <RetroOpportunities
      opportunities={opportunities || []}
      walletAddress={walletAddress}
      isConnected={isConnected}
      onConnect={connectWallet}
      onInvest={onInvest}
      onRefresh={() => handleRunScan('both')}
      loading={opportunitiesLoading || scanMutation.isPending || isInvesting}
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

