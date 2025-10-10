import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  // Added for new chart
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";
import { DollarSign, TrendingUp, CheckCircle, Shield } from "lucide-react";
import React, { useMemo, useState } from "react"; // added React and local state

function StatsCards({ totalInvested, activeCapital, avgAPY, realizedReturn }) {
  const stats = [
    {
      label: "Total Invested",
      value: `$${totalInvested.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "Active Capital",
      value: `$${activeCapital.toLocaleString()}`,
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Weighted Avg APY",
      value: `${avgAPY.toFixed(2)}%`,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Realized Return",
      value: `$${realizedReturn.toLocaleString()}`,
      icon: Shield,
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center">
            <Icon className={`w-8 h-8 ${color}`} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {label}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Build an "Active Capital over time" series from investment events (last 90 days)
function buildActiveCapitalSeries(investments, days = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const toDayKey = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  // Baseline active before window start
  let baseline = 0;
  const events = new Map(); // dayKey -> delta

  investments.forEach((inv) => {
    const amount = Number(inv.amount || 0);
    const investedAt = inv.invested_at ? new Date(inv.invested_at) : null;
    const withdrawnAt = inv.withdrawn_at ? new Date(inv.withdrawn_at) : null;

    if (!investedAt || isNaN(amount)) return;

    // If position was open before window start and still active at start, include in baseline
    if (investedAt < start && (!withdrawnAt || withdrawnAt >= start)) {
      baseline += amount;
    }

    // Event within the window: +amount on invested day (confirmed only)
    const isConfirmed =
      inv.status === "confirmed" ||
      inv.status === "pending" ||
      inv.status === "active";
    if (isConfirmed) {
      if (investedAt >= start && investedAt <= end) {
        const k = toDayKey(investedAt);
        events.set(k, (events.get(k) || 0) + amount);
      }
    }

    // Withdrawal within the window: -amount on withdrawn day
    if (withdrawnAt && withdrawnAt >= start && withdrawnAt <= end) {
      const k2 = toDayKey(withdrawnAt);
      events.set(k2, (events.get(k2) || 0) - amount);
    }
  });

  // Build daily series
  const series = [];
  let running = baseline;
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toDayKey(cursor);
    if (events.has(key)) {
      running += events.get(key);
    }
    series.push({ date: key, active: Math.max(0, Number(running.toFixed(2))) });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

// New helpers for additional chart views
function buildRealizedReturnSeries(investments, days = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const toDayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const map = new Map();
  for (const inv of investments) {
    if (inv.withdrawn_at && inv.actual_return != null) {
      const wd = new Date(inv.withdrawn_at);
      if (wd >= start && wd <= end) {
        const k = toDayKey(wd);
        map.set(k, (map.get(k) || 0) + Number(inv.actual_return || 0));
      }
    }
  }
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const k = toDayKey(cursor);
    out.push({ date: k, realized: Number(map.get(k) || 0) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function buildNetFlowsSeries(investments, days = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const toDayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const map = new Map();
  for (const inv of investments) {
    const investedAt = inv.invested_at ? new Date(inv.invested_at) : null;
    const withdrawnAt = inv.withdrawn_at ? new Date(inv.withdrawn_at) : null;
    const amt = Number(inv.amount || 0);
    if (investedAt && investedAt >= start && investedAt <= end) {
      const k = toDayKey(investedAt);
      map.set(k, (map.get(k) || 0) + amt);
    }
    if (withdrawnAt && withdrawnAt >= start && withdrawnAt <= end) {
      const k2 = toDayKey(withdrawnAt);
      map.set(k2, (map.get(k2) || 0) - amt);
    }
  }
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const k = toDayKey(cursor);
    out.push({ date: k, net: Number(map.get(k) || 0) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function buildProtocolBars(opportunities) {
  const byProtocol = new Map();
  for (const opp of opportunities) {
    const name = String(opp.protocol_name || "");
    const tvl = Number(opp.tvl || 0);
    byProtocol.set(name, (byProtocol.get(name) || 0) + tvl);
  }
  const arr = Array.from(byProtocol.entries())
    .map(([name, tvl]) => ({ name, tvlM: tvl / 1_000_000 }))
    .sort((a, b) => b.tvlM - a.tvlM)
    .slice(0, 10);
  return arr;
}

function buildApyDistribution(opportunities) {
  const buckets = [0, 2, 4, 6, 8, 10, 15, 20];
  const counts = new Array(buckets.length).fill(0);
  for (const opp of opportunities) {
    const apy = Number(opp.apy || 0);
    let idx = buckets.findIndex((b) => apy <= b);
    if (idx === -1) idx = buckets.length - 1;
    counts[idx]++;
  }
  return buckets.map((b, i) => ({
    bucket: i === 0 ? `<= ${b}%` : `${buckets[i - 1]}–${b}%`,
    count: counts[i],
  }));
}

function Charts({ opportunities, investments }) {
  // selectors for two chart slots
  const [leftView, setLeftView] = useState("active-capital");
  const [rightView, setRightView] = useState("apy-vs-risk");

  // Precompute data
  const activeCapitalData = useMemo(
    () => buildActiveCapitalSeries(investments, 90),
    [investments],
  );
  const realizedReturnData = useMemo(
    () => buildRealizedReturnSeries(investments, 90),
    [investments],
  );
  const netFlowsData = useMemo(
    () => buildNetFlowsSeries(investments, 90),
    [investments],
  );
  const scatterData = useMemo(
    () =>
      opportunities.slice(0, 50).map((opp) => ({
        name: opp.protocol_name,
        risk: Number(opp.risk_score || 0),
        apy: Number(opp.apy || 0),
        tvlM: Math.max(0.1, Number(opp.tvl || 0) / 1_000_000),
      })),
    [opportunities],
  );
  const protocolBars = useMemo(
    () => buildProtocolBars(opportunities),
    [opportunities],
  );
  const apyDist = useMemo(
    () => buildApyDistribution(opportunities),
    [opportunities],
  );

  const renderLeft = () => {
    switch (leftView) {
      case "active-capital":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Active Capital (Last 90 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activeCapitalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="#10B981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        );
      case "realized-return":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Realized Return (Last 90 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={realizedReturnData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="realized" fill="#6366F1" />
              </BarChart>
            </ResponsiveContainer>
          </>
        );
      case "net-flows":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Daily Net Flows (In - Out)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={netFlowsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="net" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </>
        );
      default:
        return null;
    }
  };

  const renderRight = () => {
    switch (rightView) {
      case "apy-vs-risk":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              APY vs Risk (Bubble ~ TVL)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="risk"
                  name="Risk"
                  domain={[0, 10]}
                  stroke="#6B7280"
                />
                <YAxis dataKey="apy" name="APY (%)" stroke="#6B7280" />
                <ZAxis dataKey="tvlM" range={[60, 400]} name="TVL (M)" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
                <Scatter
                  name="Opportunities"
                  data={scatterData}
                  fill="#3B82F6"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </>
        );
      case "tvl-by-protocol":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Top Protocols by TVL
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={protocolBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  tick={{ fontSize: 10 }}
                  stroke="#6B7280"
                />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="tvlM" name="TVL (M)" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </>
        );
      case "apy-distribution":
        return (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              APY Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={apyDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="bucket" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="count" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Left Chart
          </span>
          <select
            value={leftView}
            onChange={(e) => setLeftView(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="active-capital">Active Capital</option>
            <option value="realized-return">Realized Return</option>
            <option value="net-flows">Daily Net Flows</option>
          </select>
        </div>
        {renderLeft()}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Right Chart
          </span>
          <select
            value={rightView}
            onChange={(e) => setRightView(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="apy-vs-risk">APY vs Risk</option>
            <option value="tvl-by-protocol">Top Protocols by TVL</option>
            <option value="apy-distribution">APY Distribution</option>
          </select>
        </div>
        {renderRight()}
      </div>
    </div>
  );
}

export function DashboardTab({ opportunities, investments }) {
  // Calculate portfolio stats
  const totalInvested = investments.reduce(
    (sum, inv) => sum + parseFloat(inv.amount || 0),
    0,
  );

  const activeCapital = investments
    .filter((inv) => inv.status === "confirmed" && !inv.withdrawn_at)
    .reduce((s, inv) => s + Number(inv.amount || 0), 0);

  const realizedReturn = investments.reduce(
    (s, inv) => s + Number(inv.actual_return || 0),
    0,
  );

  // Weighted average APY of current active positions, fallback to opportunities if none
  let avgAPY = 0;
  const active = investments.filter(
    (inv) => inv.status === "confirmed" && !inv.withdrawn_at,
  );
  const weightSum = active.reduce((s, inv) => s + Number(inv.amount || 0), 0);
  if (weightSum > 0) {
    const weighted = active.reduce(
      (s, inv) => s + Number(inv.expected_apy || 0) * Number(inv.amount || 0),
      0,
    );
    avgAPY = weighted / weightSum;
  } else if (opportunities.length > 0) {
    avgAPY =
      opportunities.reduce((sum, opp) => sum + parseFloat(opp.apy || 0), 0) /
      opportunities.length;
  }

  return (
    <div className="space-y-6">
      <StatsCards
        totalInvested={totalInvested}
        activeCapital={activeCapital}
        avgAPY={avgAPY}
        realizedReturn={realizedReturn}
      />
      <Charts opportunities={opportunities} investments={investments} />

      <style jsx global>{`
        :root {
          --tooltip-bg: #ffffff;
          --tooltip-border: #e5e7eb;
        }
        .dark {
          --tooltip-bg: #374151;
          --tooltip-border: #4b5563;
        }
      `}</style>
    </div>
  );
}
