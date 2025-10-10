import React, { useState } from 'react';
import { ArrowRight, DollarSign, Target, Clock, Shield, TrendingUp } from 'lucide-react';

export function DepositInterface({ opportunities, walletBalance, onDeposit, connectedWallet }) {
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!selectedOpportunity || !depositAmount || !connectedWallet) return;

    setIsDepositing(true);
    try {
      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (onDeposit) {
        onDeposit({
          opportunity: selectedOpportunity,
          amount: depositAmount,
          token: selectedToken,
          wallet: connectedWallet
        });
      }
      
      // Reset form
      setDepositAmount('');
      setSelectedOpportunity(null);
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setIsDepositing(false);
    }
  };

  const getRiskColor = (score) => {
    if (score <= 3) return "text-green-600 bg-green-100";
    if (score <= 6) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getAvailableBalance = () => {
    return walletBalance?.[selectedToken] || '0';
  };

  const calculateProjectedEarnings = () => {
    if (!selectedOpportunity || !depositAmount) return '0';
    const amount = parseFloat(depositAmount);
    const apy = parseFloat(selectedOpportunity.apy);
    return ((amount * apy) / 100).toFixed(2);
  };

  if (!connectedWallet) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8">
        <div className="text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Wallet to Deposit</h3>
          <p className="text-gray-500">Connect your wallet to start depositing and earning yield</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Token */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          1. Select Asset to Deposit
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(walletBalance || {}).map(([token, balance]) => (
            <button
              key={token}
              onClick={() => setSelectedToken(token)}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedToken === token
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{token}</div>
                <div className="text-sm text-gray-500">{balance}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Protocol */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          2. Select Yield Opportunity
        </h3>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {opportunities
            .filter(opp => opp.token_symbol === selectedToken)
            .map((opportunity) => (
              <div
                key={opportunity.id}
                onClick={() => setSelectedOpportunity(opportunity)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedOpportunity?.id === opportunity.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-semibold text-gray-900">{opportunity.protocol_name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(opportunity.risk_score)}`}>
                        Risk: {opportunity.risk_score}/10
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {opportunity.blockchain}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        {parseFloat(opportunity.apy).toFixed(2)}% APY
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        ${(parseFloat(opportunity.tvl || 0) / 1000000).toFixed(1)}M TVL
                      </div>
                      <div className="flex items-center">
                        <Target className="w-4 h-4 mr-1" />
                        {opportunity.protocol_type}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {parseFloat(opportunity.apy).toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-500">APY</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Step 3: Enter Amount */}
      {selectedOpportunity && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            3. Enter Deposit Amount
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Deposit ({selectedToken})
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    onClick={() => setDepositAmount(getAvailableBalance().replace(/,/g, ''))}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Available: {getAvailableBalance()} {selectedToken}
              </div>
            </div>

            {/* Deposit Summary */}
            {depositAmount && selectedOpportunity && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900">Deposit Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Protocol:</span>
                    <div className="font-medium">{selectedOpportunity.protocol_name}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Network:</span>
                    <div className="font-medium capitalize">{selectedOpportunity.blockchain}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <div className="font-medium">{depositAmount} {selectedToken}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">APY:</span>
                    <div className="font-medium text-green-600">{parseFloat(selectedOpportunity.apy).toFixed(2)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Est. Yearly Earnings:</span>
                    <div className="font-medium text-green-600">${calculateProjectedEarnings()} {selectedToken}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Risk Score:</span>
                    <div className={`font-medium ${getRiskColor(selectedOpportunity.risk_score).split(' ')[0]}`}>
                      {selectedOpportunity.risk_score}/10
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {isDepositing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Deposit...</span>
                </>
              ) : (
                <>
                  <span>Deposit {selectedToken}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-xs text-gray-500 text-center">
              By depositing, you agree to the protocol's terms and understand the associated risks.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}