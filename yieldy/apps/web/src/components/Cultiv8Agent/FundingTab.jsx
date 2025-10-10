"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Play,
} from "lucide-react";

export function FundingTab() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("deposit"); // deposit | withdrawal
  const [ack, setAck] = useState(false);

  // Helper: fetch with graceful handling of 429 rate limits
  const fetchWithBackoff = async (url, options = {}, maxRetries = 3) => {
    let attempt = 0;
    let lastErr;
    while (attempt <= maxRetries) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429) {
          const retryAfter = parseInt(
            res.headers.get("Retry-After") || "0",
            10,
          );
          const delay =
            retryAfter > 0
              ? retryAfter * 1000
              : Math.min(2000 * (attempt + 1), 6000);
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
          continue;
        }
        if (!res.ok) {
          const err = new Error(
            `When fetching ${url}, the response was [${res.status}] ${res.statusText}`,
          );
          // attach status so retry logic can see it if needed
          err.status = res.status;
          throw err;
        }
        return res.json();
      } catch (e) {
        lastErr = e;
        if (e?.status === 429 && attempt < maxRetries) {
          const delay = Math.min(2000 * (attempt + 1), 6000);
          await new Promise((r) => setTimeout(r, delay));
          attempt++;
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  };

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["agent-funds"],
    queryFn: async () => {
      return fetchWithBackoff("/api/agent-funds", { method: "GET" }, 3);
    },
    // Reduce noisy refetches that can trigger rate limits
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      // be lenient with 429s, retry up to 3 times
      if (err && err.status === 429) return failureCount < 3;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 4000),
  });

  const mutateFunds = useMutation({
    mutationFn: async ({ amount, type, note }) => {
      return fetchWithBackoff(
        "/api/agent-funds",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, type, note }),
        },
        2,
      );
    },
    onSuccess: () => {
      // Only refetch active queries to avoid bursts
      queryClient.invalidateQueries({
        queryKey: ["agent-funds"],
        refetchType: "active",
      });
    },
  });

  const executeInvestments = useMutation({
    mutationFn: async () => {
      return fetchWithBackoff(
        "/api/agent/scan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockchain: "both", forceRun: true }),
        },
        1,
      );
    },
    onSuccess: () => {
      // Stagger refetches slightly to avoid rate-limit spikes
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["agent-funds"],
          refetchType: "active",
        });
      }, 300);
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["investments"],
          refetchType: "active",
        });
      }, 600);
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["performance"],
          refetchType: "active",
        });
      }, 900);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    mutateFunds.mutate({ amount: amt, type: mode, note });
  };

  const balance = data?.balance || 0;
  const invested = data?.invested || 0;
  const available = data?.available || 0;

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Fund Your Agent</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-sm text-red-700 border border-red-200 rounded">
            {(error && error.message) || "Failed to load"}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Funds" value={`$${balance.toFixed(2)}`} />
          <StatCard
            label="Currently Invested"
            value={`$${invested.toFixed(2)}`}
          />
          <StatCard
            label="Available to Invest"
            value={`$${available.toFixed(2)}`}
            highlight
          />
        </div>

        {/* Execute Investments Callout */}
        <div className="mb-6 p-4 rounded-lg border border-yellow-300 bg-yellow-50">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-700 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-yellow-800">
                To put your available funds to work, execute the agent now. This
                will analyze current opportunities and invest up to your
                available funds and configured limits.
              </div>
              <label className="mt-3 flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                <span>
                  I understand and authorize the agent to invest available funds
                  according to my risk settings.
                </span>
              </label>
              <div className="mt-3">
                <button
                  onClick={() => executeInvestments.mutate()}
                  disabled={
                    !ack ||
                    available <= 0 ||
                    executeInvestments.isLoading ||
                    isFetching
                  }
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {executeInvestments.isLoading
                      ? "Executing..."
                      : "Execute Investments Now"}
                  </span>
                </button>
                {available <= 0 && (
                  <span className="ml-3 text-sm text-gray-500">
                    No available funds to invest
                  </span>
                )}
                {/* Inline feedback for execution */}
                {executeInvestments.isError && (
                  <div className="mt-2 text-sm text-red-600">
                    {(executeInvestments.error &&
                      executeInvestments.error.message) ||
                      "Failed to execute. Please try again shortly."}
                  </div>
                )}
                {executeInvestments.isSuccess && (
                  <div className="mt-2 text-sm text-green-700">
                    Execution complete. Refreshing balances...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setMode("deposit")}
              className={`flex-1 px-3 py-2 text-sm ${mode === "deposit" ? "bg-blue-600 text-white" : "bg-white"}`}
            >
              <div className="flex items-center justify-center space-x-1">
                <PlusCircle className="w-4 h-4" />
                <span>Deposit</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("withdrawal")}
              className={`flex-1 px-3 py-2 text-sm ${mode === "withdrawal" ? "bg-blue-600 text-white" : "bg-white"}`}
            >
              <div className="flex items-center justify-center space-x-1">
                <MinusCircle className="w-4 h-4" />
                <span>Withdraw</span>
              </div>
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (USD)"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            disabled={mutateFunds.isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-4 py-2 rounded-lg"
          >
            {mutateFunds.isLoading
              ? "Processing..."
              : mode === "deposit"
                ? "Add Funds"
                : "Withdraw"}
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {(data?.transactions || []).map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2 pr-4 text-gray-700">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 capitalize">{t.type}</td>
                  <td className="py-2 pr-4">
                    ${parseFloat(t.amount).toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{t.note || "-"}</td>
                </tr>
              ))}
              {(!data?.transactions || data.transactions.length === 0) && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={4}>
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div
      className={`p-4 rounded-lg border ${highlight ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
