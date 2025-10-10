import {
  Activity,
  TrendingUp,
  DollarSign,
  Info,
  Settings,
  Wallet,
  BarChart2,
} from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "opportunities", label: "Opportunities", icon: TrendingUp },
  { id: "funding", label: "Funding", icon: Wallet },
  { id: "performance", label: "Performance", icon: BarChart2 },
  { id: "investments", label: "Investments", icon: DollarSign },
  { id: "risk-methodology", label: "Risk Methodology", icon: Info },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation({ activeTab, setActiveTab }) {
  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Enable horizontal scroll on small screens so later tabs aren't cut off */}
        <div className="overflow-x-auto">
          <div className="flex space-x-8 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
