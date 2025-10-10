"use client";
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Activity, Info } from "lucide-react"; // added Info icon for tooltips

export function PerformanceTab() {
  const [bucket, setBucket] = useState("day"); // day | week | month
  const [days, setDays] = useState(90); // 1 | 7 | 30 | 90
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [compareCurrency, setCompareCurrency] = useState(""); // e.g., "CHF"

  const { data, isLoading, error } = useQuery({
    queryKey: ["performance", { days, bucket, baseCurrency, compareCurrency }],
    queryFn: async () => {
      const params = new URLSearchParams({
        days: String(days),
        bucket,
        baseCurrency,
      });
      if (compareCurrency) params.set("compareCurrency", compareCurrency);
      const url = `/api/performance?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(
          `When fetching /api/performance, the response was [${res.status}] ${res.statusText}`,
        );
      return res.json();
    },
  });

  const k = data?.kpis || {
    totalInvested: 0,
    realizedReturn: 0,
    roi: 0,
    realRoi: 0,
    totalTrades: 0,
  };

  // Added meta helpers for tooltips
  const meta = data?.meta || {};
  const windowDays = meta.days || days;
  const inflationPct =
    typeof meta.inflationPctForWindow === "number"
      ? meta.inflationPctForWindow
      : undefined;

  // Build concise tooltip strings describing calculations
  const nominalTooltip = useMemo(() => {
    // Describe how nominal ROI is computed in backend
    return `Nominal ROI = (realized P&L + accrued P&L on open positions) ÷ (realized invested + open principal) × 100 over the last ${windowDays} day(s). Accrued is pro‑rated by expected APY since invest date.`;
  }, [windowDays]);

  const realTooltip = useMemo(() => {
    const infTxt =
      typeof inflationPct === "number"
        ? `${inflationPct.toFixed(2)}%`
        : "the period's inflation";
    return `Real ROI adjusts for inflation over the window: ((1 + nominal) ÷ (1 + ${infTxt})) − 1, shown as a %. This removes the effect of price level changes.`;
  }, [inflationPct]);

  const fx = data?.fx;
  const fxSummary =
    fx?.pair && typeof fx.changePct === "number"
      ? `${fx.pair} ${fx.changePct.toFixed(2)}%`
      : compareCurrency
        ? `${baseCurrency}/${compareCurrency} n/a`
        : "";

  const fxTooltip = useMemo(() => {
    if (fx?.pair && typeof fx.changePct === "number") {
      return `FX (${fx.pair}) shows % change in the exchange rate over the last ${windowDays} day(s): (last − first) ÷ first × 100. Positive means ${baseCurrency} strengthened vs ${compareCurrency || fx.pair.split("/")[1]}.`;
    }
    if (compareCurrency) {
      return `FX (${baseCurrency}/${compareCurrency}) compares base vs. compare currency over the last ${windowDays} day(s). Data may be unavailable for some pairs.`;
    }
    return `Select a compare currency to see the base/compare rate change over the selected window.`;
  }, [fx, windowDays, baseCurrency, compareCurrency]);

  const chartData = useMemo(() => {
    const series = data?.series || [];
    return series.map((d) => {
      const label = new Date(d.day).toLocaleDateString();
      return {
        date: label,
        invested: Number(d.invested || 0),
        realized: Number(d.realized || 0),
      };
    });
  }, [data]);

  const isDay = bucket === "day";
  const isWeek = bucket === "week";
  const isMonth = bucket === "month";
  const is1 = days === 1;
  const is7 = days === 7;
  const is30 = days === 30;
  const is90 = days === 90;

  const rangeLabel = is1 ? "1D" : is7 ? "1W" : is30 ? "1M" : "90D";

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Performance Tracker
            </h2>
          </div>
          {/* Controls */}
          <div className="flex items-center space-x-4">
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setBucket("day")}
                className={`px-3 py-1 text-sm ${isDay ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                Daily
              </button>
              <button
                onClick={() => setBucket("week")}
                className={`px-3 py-1 text-sm border-l ${isWeek ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setBucket("month")}
                className={`px-3 py-1 text-sm border-l ${isMonth ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                Monthly
              </button>
            </div>
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setDays(1)}
                className={`px-3 py-1 text-sm ${is1 ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                1D
              </button>
              <button
                onClick={() => setDays(7)}
                className={`px-3 py-1 text-sm border-l ${is7 ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                1W
              </button>
              <button
                onClick={() => setDays(30)}
                className={`px-3 py-1 text-sm border-l ${is30 ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                1M
              </button>
              <button
                onClick={() => setDays(90)}
                className={`px-3 py-1 text-sm border-l ${is90 ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
              >
                90D
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Base</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
              <label className="text-sm text-gray-600">Compare</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={compareCurrency}
                onChange={(e) => setCompareCurrency(e.target.value)}
              >
                <option value="">None</option>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-sm text-red-700 border border-red-200 rounded">
            {(error && error.message) || "Failed to load"}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Kpi
            label="Capital At Work"
            value={`$${k.totalInvested?.toFixed(2)}`}
          />
          <Kpi
            label="Realized Return"
            value={`$${k.realizedReturn?.toFixed(2)}`}
          />
          <Kpi
            label="ROI (Nominal)"
            value={`${k.roi?.toFixed(2)}%`}
            tooltip={nominalTooltip}
          />
          <Kpi
            label="ROI (Real)"
            value={`${k.realRoi?.toFixed(2)}%`}
            tooltip={realTooltip}
          />
          <Kpi
            label="FX (Window)"
            value={fxSummary || `${rangeLabel} · ${bucket}`}
            tooltip={fxTooltip}
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {rangeLabel} · {bucket[0].toUpperCase() + bucket.slice(1)} Aggregation
        </h3>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorInv)"
                name="Invested"
              />
              <Area
                type="monotone"
                dataKey="realized"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorReal)"
                name="Realized Return"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tooltip }) {
  // Add a small custom tooltip that works consistently across browsers
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
      <div className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1 relative">
        <span>{label}</span>
        {tooltip ? (
          <button
            type="button"
            aria-label="Info"
            className="relative"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={() => setOpen((v) => !v)}
          >
            <Info className="w-4 h-4 text-gray-400 cursor-pointer" />
            {open && (
              <div className="absolute z-20 left-0 mt-2 w-64 p-2 text-[11px] leading-snug bg-white border border-gray-200 rounded shadow-lg text-gray-700">
                {tooltip}
              </div>
            )}
          </button>
        ) : null}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
