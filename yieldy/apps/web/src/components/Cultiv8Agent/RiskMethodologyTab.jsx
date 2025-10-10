import {
  Shield,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  Clock,
  Infinity,
} from "lucide-react";

export function RiskMethodologyTab() {
  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-900">
            Risk Scoring Methodology
          </h2>
        </div>

        <div className="prose max-w-none">
          <p className="text-lg text-gray-600 mb-8">
            Our AI agent uses a comprehensive 10-point risk scoring system to
            evaluate USDC yield opportunities. Lower scores indicate safer
            investments, while higher scores represent more aggressive
            strategies.
          </p>

          {/* Risk Scale Overview */}
          <div className="bg-gradient-to-r from-green-50 to-red-50 p-6 rounded-lg mb-8">
            <h3 className="text-xl font-semibold mb-4">Risk Scale (1-10)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
                <h4 className="font-semibold text-green-800">
                  Low Risk (1-3)
                </h4>
                <p className="text-sm text-green-700">
                  Established protocols, high TVL, battle-tested smart
                  contracts
                </p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg border-l-4 border-yellow-500">
                <h4 className="font-semibold text-yellow-800">
                  Medium Risk (4-6)
                </h4>
                <p className="text-sm text-yellow-700">
                  Newer protocols, moderate TVL, some track record
                </p>
              </div>
              <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
                <h4 className="font-semibold text-red-800">
                  High Risk (7-10)
                </h4>
                <p className="text-sm text-red-700">
                  Experimental protocols, low TVL, unproven contracts
                </p>
              </div>
            </div>
          </div>

          {/* Scoring Factors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                Protocol Factors (40% Weight)
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Age & Track Record:</strong> Protocols operating for
                  2+ years get lower risk scores
                </li>
                <li>
                  <strong>Audit History:</strong> Multiple security audits by
                  reputable firms reduce risk
                </li>
                <li>
                  <strong>Bug Bounty Programs:</strong> Active security
                  programs indicate robust testing
                </li>
                <li>
                  <strong>Governance Structure:</strong> Decentralized
                  governance reduces protocol risk
                </li>
                <li>
                  <strong>Team Reputation:</strong> Known, doxxed teams with
                  DeFi experience
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <DollarSign className="w-5 h-5 text-emerald-600 mr-2" />
                Financial Factors (35% Weight)
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Total Value Locked (TVL):</strong> Higher TVL
                  indicates more trust and stability
                </li>
                <li>
                  <strong>APY Sustainability:</strong> Extremely high APYs
                  (&gt;50%) increase risk scores
                </li>
                <li>
                  <strong>Liquidity Depth:</strong> Deep liquidity pools reduce
                  slippage and exit risks
                </li>
                <li>
                  <strong>Revenue Sources:</strong> Clear, sustainable revenue
                  models preferred
                </li>
                <li>
                  <strong>Token Economics:</strong> Non-inflationary
                  tokenomics reduce long-term risks
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                Technical Factors (15% Weight)
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Smart Contract Complexity:</strong> Simpler contracts
                  have fewer potential vulnerabilities
                </li>
                <li>
                  <strong>Upgrade Mechanisms:</strong> Immutable contracts
                  preferred over upgradeable ones
                </li>
                <li>
                  <strong>Oracle Dependencies:</strong> Multiple oracle sources
                  reduce manipulation risk
                </li>
                <li>
                  <strong>Composability Risk:</strong> Integration with other
                  protocols adds complexity
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 text-teal-600 mr-2" />
                Market Factors (10% Weight)
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Market Conditions:</strong> Bull/bear market cycles
                  affect protocol performance
                </li>
                <li>
                  <strong>Regulatory Risk:</strong> Potential regulatory
                  changes in key jurisdictions
                </li>
                <li>
                  <strong>Competition:</strong> Market saturation and
                  competitive pressures
                </li>
                <li>
                  <strong>Network Risk:</strong> Blockchain-specific risks
                  (Ethereum gas, Base adoption)
                </li>
              </ul>
            </div>
          </div>

          {/* Protocol Examples */}
          <div className="bg-white border rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Risk Score Examples</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Protocol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rationale
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      Aave v3
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      Lending
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        3/10
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Established protocol, $10B+ TVL, multiple audits, 3+
                      years operation
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      Compound v3
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      Lending
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        4/10
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Proven protocol, recent v3 upgrade adds some complexity
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      Uniswap v3
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      Liquidity Pool
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        7/10
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Impermanent loss risk, complex concentrated liquidity
                      mechanics
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      New DeFi Protocol
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      Yield Farming
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        9/10
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Unaudited contracts, high APY (&gt;100%), low TVL,
                      anonymous team
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Agent Decision Process */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-emerald-900">
              <Infinity className="w-5 h-5 mr-2" />
              AI Agent Decision Process
            </h3>
            <div className="text-emerald-800">
              <ol className="list-decimal list-inside space-y-2 mb-4">
                <li>
                  <strong>Initial Screening:</strong> Filter opportunities by
                  minimum APY and maximum risk score
                </li>
                <li>
                  <strong>Risk Assessment:</strong> Calculate comprehensive
                  risk score using factors above
                </li>
                <li>
                  <strong>AI Analysis:</strong> ChatGPT evaluates qualitative
                  factors and market conditions
                </li>
                <li>
                  <strong>Portfolio Balance:</strong> Consider existing
                  positions and diversification
                </li>
                <li>
                  <strong>Investment Decision:</strong> Determine investment
                  amount based on confidence level
                </li>
                <li>
                  <strong>Continuous Monitoring:</strong> Re-evaluate
                  positions as market conditions change
                </li>
              </ol>
              <div className="bg-emerald-100 p-4 rounded border-l-4 border-emerald-400">
                <p className="text-sm">
                  <strong>Note:</strong> The AI agent will never invest in
                  opportunities with risk scores exceeding your configured
                  maximum risk tolerance, regardless of potential returns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
