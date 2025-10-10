"use client";

import React, { useEffect, useState } from "react"; // add useEffect
import { useQueryClient } from "@tanstack/react-query";
import { useCultiv8AgentData } from "@/hooks/useCultiv8AgentData";
import { Header } from "@/components/Cultiv8Agent/Header";
import { Navigation } from "@/components/Cultiv8Agent/Navigation";
import { DashboardTab } from "@/components/Cultiv8Agent/DashboardTab";
import { OpportunitiesTab } from "@/components/Cultiv8Agent/OpportunitiesTab";
import { InvestmentsTab } from "@/components/Cultiv8Agent/InvestmentsTab";
import { RiskMethodologyTab } from "@/components/Cultiv8Agent/RiskMethodologyTab";
import { SettingsTab } from "@/components/Cultiv8Agent/SettingsTab";
import { LoadingSpinner } from "@/components/Cultiv8Agent/LoadingSpinner";
import { WalletConnect } from "@/components/Cultiv8Agent/WalletConnect";
import { DepositInterface } from "@/components/Cultiv8Agent/DepositInterface";
import { FundingTab } from "@/components/Cultiv8Agent/FundingTab";
import { PerformanceTab } from "@/components/Cultiv8Agent/PerformanceTab";
import { Wallet } from "lucide-react";

export function Cultiv8Agent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const queryClient = useQueryClient();

  const {
    config,
    configLoading,
    opportunities,
    investments,
    scanMutation,
    updateConfigMutation,
    schedulerMutation, // NEW
    handleRunScan,
    toggleAutoInvest,
  } = useCultiv8AgentData();

  // Scheduler heartbeat - only run if auto-invest is enabled
  useEffect(() => {
    // Skip if auto-invest is disabled or no config yet
    if (!config?.auto_invest_enabled) return;
    
    // Fire once on mount
    schedulerMutation.mutate();
    const id = setInterval(
      () => {
        if (!schedulerMutation.isPending && config?.auto_invest_enabled) {
          schedulerMutation.mutate();
        }
      },
      5 * 60 * 1000,
    ); // every 5 minutes
    return () => clearInterval(id);
  }, [schedulerMutation, config?.auto_invest_enabled]);

  // Render immediately - no loading screen
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardTab
            opportunities={opportunities}
            investments={investments}
          />
        );
      case "opportunities":
        return (
          <OpportunitiesTab
            opportunities={opportunities}
            handleRunScan={handleRunScan}
          />
        );
      case "funding":
        return <FundingTab />;
      case "performance":
        return <PerformanceTab />;
      case "investments":
        return <InvestmentsTab investments={investments} />;
      case "risk-methodology":
        return <RiskMethodologyTab />;
      case "settings":
        return <SettingsTab config={config} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        config={config}
        toggleAutoInvest={toggleAutoInvest}
        handleRunScan={handleRunScan}
        scanMutation={scanMutation}
        updateConfigMutation={updateConfigMutation}
      />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
}
