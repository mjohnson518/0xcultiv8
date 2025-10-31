import { FEE_TIERS, formatFeeAmount, formatPercent } from '../../utils/feeCalculator';

/**
 * RetroFeeTable Component
 * Displays the tiered fee structure in retro ASCII style
 */
export function RetroFeeTable({ currentTier = 'community', currentAUM = 0, className = '' }) {
  const tiers = Object.keys(FEE_TIERS);

  return (
    <div className={`font-mono text-sm ${className}`}>
      {/* Table Header with ASCII border */}
      <div className="border-2 border-retro-black bg-retro-bg overflow-x-auto">
        <div className="p-3">
          <div className="text-xs uppercase text-retro-gray-600 mb-2">
            ╔═════════════════════════════════════════════════════════════╗
          </div>
          
          {/* Header Row */}
          <div className="grid grid-cols-5 gap-2 font-bold text-xs uppercase pb-2 border-b-2 border-retro-gray-300">
            <div>TIER</div>
            <div className="text-right">MIN AUM</div>
            <div className="text-right">MGMT FEE</div>
            <div className="text-right">PERF FEE</div>
            <div className="text-center">STATUS</div>
          </div>

          {/* Tier Rows */}
          {tiers.map((tierKey, index) => {
            const tier = FEE_TIERS[tierKey];
            const isCurrentTier = tierKey === currentTier;
            const isEligible = currentAUM >= tier.minimumAUM;
            const isLocked = !isEligible;

            return (
              <div
                key={tierKey}
                className={`
                  grid grid-cols-5 gap-2 py-2 border-b border-retro-gray-200
                  ${isCurrentTier ? 'retro-bg-black retro-text-bg font-bold' : 'text-retro-fg'}
                `}
              >
                {/* Tier Name */}
                <div className="flex items-center gap-1">
                  <span className={`${tier.color} text-lg`}>{tier.icon}</span>
                  <span className={isCurrentTier ? 'retro-text-bg' : 'text-retro-fg'}>
                    {tier.name}
                  </span>
                  {isCurrentTier && (
                    <span className="text-xs px-1 border border-retro-white">YOU</span>
                  )}
                </div>

                {/* Minimum AUM */}
                <div className={`text-right text-xs ${isCurrentTier ? 'retro-text-bg' : 'text-retro-gray-600'}`}>
                  {formatFeeAmount(tier.minimumAUM)}
                </div>

                {/* Management Fee */}
                <div className={`text-right ${isCurrentTier ? 'retro-text-bg' : 'text-retro-fg'}`}>
                  {formatPercent(tier.managementFeePercent)}
                </div>

                {/* Performance Fee */}
                <div className={`text-right ${isCurrentTier ? 'retro-text-bg' : 'text-retro-fg'}`}>
                  {formatPercent(tier.performanceFeePercent)}
                </div>

                {/* Status */}
                <div className="text-center">
                  {isCurrentTier ? (
                    <span className="text-retro-green">[●ACTIVE]</span>
                  ) : isEligible ? (
                    <span className="text-retro-blue">[✓ELIGIBLE]</span>
                  ) : (
                    <span className="text-retro-gray-500">[○LOCKED]</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer with ASCII border */}
          <div className="text-xs uppercase text-retro-gray-600 mt-2">
            ╚═════════════════════════════════════════════════════════════╝
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 p-2 border border-retro-gray-300 bg-retro-bg">
        <div className="text-xs text-retro-gray-600 space-y-1">
          <p>
            <span className="text-retro-green">[●ACTIVE]</span> Your current tier
          </p>
          <p>
            <span className="text-retro-blue">[✓ELIGIBLE]</span> Available for upgrade
          </p>
          <p>
            <span className="text-retro-gray-500">[○LOCKED]</span> Requires higher AUM
          </p>
        </div>
      </div>

      {/* Fee Explanation */}
      <div className="mt-3 p-2 border border-retro-gray-300 bg-retro-bg text-xs space-y-1 text-retro-gray-600">
        <p>
          <span className="text-retro-fg font-semibold">MGMT FEE:</span> Annual percentage of Assets Under Management (AUM), collected monthly
        </p>
        <p>
          <span className="text-retro-fg font-semibold">PERF FEE:</span> Percentage of realized profits, collected on withdrawal
        </p>
        <p className="text-retro-amber mt-2">
          ⚡ Tier upgrades are automatic and permanent when AUM threshold is met
        </p>
      </div>
    </div>
  );
}

/**
 * RetroFeeBreakdown Component
 * Shows user's current fee structure and projections
 */
export function RetroFeeBreakdown({ 
  tier = 'community', 
  aum = 0, 
  monthlyMgmtFee = 0,
  annualMgmtFee = 0,
  className = '' 
}) {
  const tierConfig = FEE_TIERS[tier];

  return (
    <div className={`font-mono ${className}`}>
      <div className="border-3 retro-border bg-retro-bg p-4">
        {/* ASCII Art Border */}
        <div className="text-retro-gray-600 text-xs mb-3">
          {'═'.repeat(40)}
        </div>

        {/* Current Tier */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm">CURRENT TIER:</span>
          <span className={`text-lg ${tierConfig.color} flex items-center gap-2`}>
            <span>{tierConfig.icon}</span>
            <span className="font-bold text-retro-fg">{tierConfig.name.toUpperCase()}</span>
          </span>
        </div>

        {/* Fee Structure */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-retro-gray-600">Management Fee:</span>
            <span className="text-retro-fg font-semibold">
              {formatPercent(tierConfig.managementFeePercent)} annually
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-retro-gray-600">Performance Fee:</span>
            <span className="text-retro-fg font-semibold">
              {formatPercent(tierConfig.performanceFeePercent)} on profits
            </span>
          </div>

          <div className="flex justify-between border-t border-retro-gray-300 pt-2">
            <span className="text-retro-gray-600">Current AUM:</span>
            <span className="text-retro-fg font-semibold">
              {formatFeeAmount(aum)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="text-retro-gray-600 text-xs my-3">
          {'─'.repeat(40)}
        </div>

        {/* Fee Projections */}
        <div className="space-y-2 text-sm">
          <div className="text-xs uppercase text-retro-gray-600 mb-2">
            FEE PROJECTIONS:
          </div>
          
          <div className="flex justify-between">
            <span className="text-retro-gray-600">Monthly Management Fee:</span>
            <span className="text-retro-green font-pixel">
              {formatFeeAmount(monthlyMgmtFee)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-retro-gray-600">Projected Annual:</span>
            <span className="text-retro-green font-pixel">
              {formatFeeAmount(annualMgmtFee)}
            </span>
          </div>
        </div>

        {/* ASCII Art Border */}
        <div className="text-retro-gray-600 text-xs mt-3">
          {'═'.repeat(40)}
        </div>
      </div>

      {/* Next Collection Date */}
      <div className="mt-2 text-xs text-retro-gray-600 text-center">
        Next collection: 1st of next month
      </div>
    </div>
  );
}

export default RetroFeeTable;

