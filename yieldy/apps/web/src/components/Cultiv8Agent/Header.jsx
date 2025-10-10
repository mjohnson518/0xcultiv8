import { Pause, Play, Zap, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Cultiv8Logo } from "./Cultiv8Logo";

export function Header({
  config,
  toggleAutoInvest,
  handleRunScan,
  scanMutation,
  updateConfigMutation,
}) {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldBeDark =
      savedTheme === "dark" || (!savedTheme && systemPrefersDark);

    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
  }, []);

  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    applyTheme(newIsDark);
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Cultiv8Logo className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Cultiv8 Agent
            </h1>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                config?.auto_invest_enabled
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300"
              }`}
            >
              {config?.auto_invest_enabled ? "Active" : "Paused"}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={toggleAutoInvest}
              disabled={updateConfigMutation.isLoading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                config?.auto_invest_enabled
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
              }`}
            >
              {config?.auto_invest_enabled ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>
                {config?.auto_invest_enabled ? "Pause Agent" : "Start Agent"}
              </span>
            </button>

            <button
              onClick={() => handleRunScan()}
              disabled={scanMutation.isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              <span>{scanMutation.isLoading ? "Scanning..." : "Run Scan"}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
