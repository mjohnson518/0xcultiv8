import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const ConfigItem = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <div className="text-lg font-semibold text-gray-900">{value}</div>
  </div>
);

export function SettingsTab({ config }) {
  const queryClient = useQueryClient();

  const updateConfig = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(
          `When fetching /api/agent-config, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
    // Optimistic update so the selection reflects immediately
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["agent-config"] });
      const previous = queryClient.getQueryData(["agent-config"]);
      const next = previous
        ? { ...previous, ...payload, updated_at: new Date().toISOString() }
        : payload;
      queryClient.setQueryData(["agent-config"], next);
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["agent-config"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-config"] });
    },
  });

  const riskProfile = useMemo(() => {
    if (!config) return "balanced";
    const { max_risk_score, min_apy_threshold } = config;
    if (max_risk_score <= 3 && min_apy_threshold <= 4) return "conservative";
    if (max_risk_score >= 7 && min_apy_threshold >= 6.5) return "aggressive";
    return "balanced";
  }, [config]);

  if (!config) return null;

  const settings = [
    {
      label: "Max Investment Per Opportunity",
      value: `$${config.max_investment_per_opportunity?.toLocaleString() || "0"}`,
    },
    {
      label: "Max Total Investment",
      value: `$${config.max_total_investment?.toLocaleString() || "0"}`,
    },
    {
      label: "Minimum APY Threshold",
      value: `${config.min_apy_threshold || 0}%`,
    },
    { label: "Max Risk Score", value: `${config.max_risk_score || 0}/10` },
    {
      label: "Scan Interval",
      value: `${config.scan_interval_minutes || 0} minutes`,
    },
    {
      label: "Auto-Invest Status",
      value: (
        <span
          className={
            config.auto_invest_enabled ? "text-green-600" : "text-red-600"
          }
        >
          {config.auto_invest_enabled ? "Enabled" : "Disabled"}
        </span>
      ),
    },
  ];

  const applyRiskProfile = (profile) => {
    const presets = {
      conservative: {
        max_risk_score: 3,
        min_apy_threshold: 4.0,
        max_investment_per_opportunity: 500,
      },
      balanced: {
        max_risk_score: 5,
        min_apy_threshold: 5.0,
        max_investment_per_opportunity: 1000,
      },
      aggressive: {
        max_risk_score: 8,
        min_apy_threshold: 6.5,
        max_investment_per_opportunity: 2500,
      },
    };
    updateConfig.mutate(presets[profile]);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Agent Configuration</h2>

      {/* Risk Tolerance */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Risk Tolerance
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose a risk level to guide how your agent invests.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => applyRiskProfile("conservative")}
            className={`p-4 rounded-lg border-2 text-left ${riskProfile === "conservative" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
          >
            <div className="font-semibold text-gray-900 mb-1">Conservative</div>
            <div className="text-sm text-gray-600">
              Lower risk (≤3), APY ≥ 4%, smaller position sizes
            </div>
          </button>
          <button
            onClick={() => applyRiskProfile("balanced")}
            className={`p-4 rounded-lg border-2 text-left ${riskProfile === "balanced" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
          >
            <div className="font-semibold text-gray-900 mb-1">Balanced</div>
            <div className="text-sm text-gray-600">
              Medium risk (≤5), APY ≥ 5%, standard position sizes
            </div>
          </button>
          <button
            onClick={() => applyRiskProfile("aggressive")}
            className={`p-4 rounded-lg border-2 text-left ${riskProfile === "aggressive" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
          >
            <div className="font-semibold text-gray-900 mb-1">Aggressive</div>
            <div className="text-sm text-gray-600">
              Higher risk (≤8), APY ≥ 6.5%, larger position sizes
            </div>
          </button>
        </div>
        {updateConfig.isError && (
          <div className="mt-3 p-3 bg-red-50 text-sm text-red-700 border border-red-200 rounded">
            Failed to update risk settings
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings.map((setting) => (
            <ConfigItem key={setting.label} {...setting} />
          ))}
        </div>
      </div>
    </div>
  );
}
