"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useCultiv8AgentData() {
  const queryClient = useQueryClient();

  // Fetch agent configuration with timeout and default values
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["agent-config"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      try {
        const response = await fetch("/api/agent-config", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Failed to fetch config");
        const data = await response.json();
        return data.config;
      } catch (error) {
        clearTimeout(timeoutId);
        // Return default config if fetch fails
        return {
          max_investment_per_opportunity: 1000,
          max_total_investment: 10000,
          min_apy_threshold: 5.0,
          max_risk_score: 7,
          auto_invest_enabled: false,
          scan_interval_minutes: 1440,
        };
      }
    },
    retry: false, // Don't retry failed requests
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch cultiv8 opportunities with timeout
  const { data: opportunities = [], isLoading: opportunitiesLoading } =
    useQuery({
      queryKey: ["cultiv8-opportunities"],
      queryFn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
          const response = await fetch("/api/cultiv8-opportunities", {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error("Failed to fetch opportunities");
          const data = await response.json();
          return data.opportunities;
        } catch (error) {
          clearTimeout(timeoutId);
          return []; // Return empty array on error
        }
      },
      retry: false,
      staleTime: 1000 * 60 * 2,
    });

  // Fetch investments with timeout
  const { data: investments = [], isLoading: investmentsLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        const response = await fetch("/api/investments", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Failed to fetch investments");
        const data = await response.json();
        return data.investments;
      } catch (error) {
        clearTimeout(timeoutId);
        return []; // Return empty array on error
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 2,
  });

  // Run agent scan mutation
  const scanMutation = useMutation({
    mutationFn: async ({ blockchain, forceRun }) => {
      const response = await fetch("/api/agent/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockchain, forceRun }),
      });
      if (!response.ok) throw new Error("Failed to run scan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cultiv8-opportunities"],
      });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig) => {
      const response = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error("Failed to update config");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-config"] });
    },
  });

  // NEW: scheduler tick mutation (safe no-op if not due)
  const schedulerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/agent/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tick: true }),
      });
      if (!response.ok) throw new Error("Scheduler failed");
      return response.json();
    },
    onSuccess: () => {
      // Refresh data if scheduler may have changed them
      queryClient.invalidateQueries({ queryKey: ["cultiv8-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["agent-config"] });
    },
  });

  const handleRunScan = useCallback(
    (blockchain = "both", forceRun = true) => {
      scanMutation.mutate({ blockchain, forceRun });
    },
    [scanMutation],
  );

  const toggleAutoInvest = useCallback(() => {
    if (config) {
      updateConfigMutation.mutate({
        auto_invest_enabled: !config.auto_invest_enabled,
      });
    }
  }, [config, updateConfigMutation]);

  return {
    config,
    configLoading,
    opportunities,
    opportunitiesLoading,
    investments,
    investmentsLoading,
    scanMutation,
    updateConfigMutation,
    schedulerMutation,
    handleRunScan,
    toggleAutoInvest,
  };
}
