const RiskIndicator = ({ score }) => {
  const getRiskColor = () => {
    if (score <= 3) return "bg-green-400";
    if (score <= 6) return "bg-yellow-400";
    return "bg-red-400";
  };
  return <div className={`w-2 h-2 rounded-full mr-2 ${getRiskColor()}`}></div>;
};

const BlockchainTag = ({ blockchain }) => (
  <span
    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
      blockchain === "ethereum"
        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
        : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
    }`}
  >
    {blockchain}
  </span>
);

export function OpportunitiesTab({ opportunities, handleRunScan }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Cultiv8 Opportunities
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => handleRunScan("ethereum")}
            className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
          >
            Scan Ethereum
          </button>
          <button
            onClick={() => handleRunScan("base")}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors"
          >
            Scan Base
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Protocol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Blockchain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                APY
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                TVL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {opportunities.map((opportunity) => (
              <tr
                key={opportunity.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {opportunity.protocol_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {opportunity.pool_address.substring(0, 10)}...
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <BlockchainTag blockchain={opportunity.blockchain} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {parseFloat(opportunity.apy).toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  ${(parseFloat(opportunity.tvl || 0) / 1000000).toFixed(1)}M
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <RiskIndicator score={opportunity.risk_score} />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {opportunity.risk_score}/10
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {opportunity.protocol_type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
