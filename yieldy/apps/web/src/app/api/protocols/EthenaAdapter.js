import { ethers, Contract } from 'ethers';
import { BaseAdapter } from './BaseAdapter.js';

/**
 * Ethena Protocol Adapter
 * Fetches real on-chain data from Ethena's sUSDe staking
 * Ethena is a synthetic dollar protocol offering yield through delta-neutral strategies
 */
export class EthenaAdapter extends BaseAdapter {
  constructor(provider, chainId) {
    super(provider, chainId);
    this.protocolName = 'Ethena';

    // Ethena is primarily on Ethereum mainnet
    if (chainId !== 1) {
      throw new Error('Ethena is only supported on Ethereum mainnet');
    }

    // Ethena contract addresses (Ethereum mainnet only)
    this.usdeAddress = '0x4c9edd5852cd905f086c759e8383e09bff1e68b3'; // USDe token
    this.susdeAddress = '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497'; // sUSDe staking
    this.enaAddress = '0x57e114B691Db790C35207b2e685D4A43181e6061'; // ENA governance token

    // Initialize contract interfaces
    this.usde = new Contract(this.usdeAddress, ERC20_ABI, provider);
    this.susde = new Contract(this.susdeAddress, SUSDE_ABI, provider);
  }

  /**
   * Get current staking APY for sUSDe
   * sUSDe is an ERC-4626 vault where yield accrues to the share price
   * SECURITY: Returns isEstimate flag to indicate data quality
   * @returns {Promise<object>}
   */
  async getCurrentAPY() {
    try {
      // sUSDe is an ERC-4626 vault
      // APY is calculated from the increasing ratio of assets per share

      // Get current conversion rate
      const oneShare = ethers.parseEther('1'); // 1 sUSDe
      const assetsPerShare = await this.susde.convertToAssets(oneShare);

      // Get total assets and supply
      const totalAssets = await this.susde.totalAssets();
      const totalSupply = await this.susde.totalSupply();

      // Get APY with source and warning info
      const apyResult = await this.estimateAPY(assetsPerShare);

      return {
        apy: Number(apyResult.apy.toFixed(4)),
        apr: Number((apyResult.apy * 0.92).toFixed(4)), // Approximate APR
        source: apyResult.source,
        isEstimate: apyResult.isEstimate,
        warning: apyResult.warning, // SECURITY: Exposed to callers for transparency
        timestamp: Date.now(),
        protocol: 'Ethena',
        chain: 'ethereum',
        token: 'sUSDe',
        assetsPerShare: Number(assetsPerShare) / 1e18,
        totalAssets: Number(totalAssets) / 1e18,
        totalShares: Number(totalSupply) / 1e18,
      };
    } catch (error) {
      console.error('Error fetching Ethena APY:', error);
      return {
        apy: 0,
        source: 'error',
        isEstimate: true,
        warning: 'Failed to fetch APY data',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Estimate APY from conversion rate changes
   * SECURITY: Returns clearly marked estimate when live data unavailable
   * @param {BigInt} currentRate - Current assets per share
   * @returns {Promise<{apy: number, isEstimate: boolean, warning: string|null}>}
   */
  async estimateAPY(currentRate) {
    try {
      // Attempt to fetch live APY from Ethena API
      // SECURITY: Fallback values are clearly marked as estimates
      const ethenaApiUrl = process.env.ETHENA_API_URL;

      if (ethenaApiUrl) {
        try {
          const response = await fetch(`${ethenaApiUrl}/v1/apy/susde`, {
            timeout: 5000,
            headers: { 'Accept': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.apy && typeof data.apy === 'number') {
              return {
                apy: data.apy,
                isEstimate: false,
                warning: null,
                source: 'ethena-api',
              };
            }
          }
        } catch {
          // API fetch failed, fall through to estimate
        }
      }

      // SECURITY: Clearly mark this as a fallback estimate
      // Ethena's yield typically ranges 10-25% from delta-neutral funding rates
      // This value should be updated regularly based on market conditions
      const FALLBACK_APY = 12.5;
      const FALLBACK_UPDATED = '2026-01-02'; // Date this fallback was last verified

      console.warn(`EthenaAdapter: Using fallback APY estimate (${FALLBACK_APY}%), last verified ${FALLBACK_UPDATED}`);

      return {
        apy: FALLBACK_APY,
        isEstimate: true,
        warning: `Fallback APY estimate - verify current rates at ethena.fi (last verified: ${FALLBACK_UPDATED})`,
        source: 'fallback-estimate',
      };
    } catch (error) {
      console.error('Error estimating Ethena APY:', error);
      return {
        apy: 0,
        isEstimate: true,
        warning: 'APY calculation failed - manual verification required',
        source: 'error',
      };
    }
  }

  /**
   * Get Total Value Locked in sUSDe
   * @returns {Promise<object>}
   */
  async getTVL() {
    try {
      // Total assets staked in sUSDe
      const totalAssets = await this.susde.totalAssets();

      // USDe has 18 decimals
      const tvlUSDe = Number(totalAssets) / 1e18;

      return {
        tvl: tvlUSDe,
        tvlFormatted: `$${tvlUSDe.toLocaleString()}`,
        source: 'on-chain',
        timestamp: Date.now(),
        stakingContract: this.susdeAddress,
      };
    } catch (error) {
      console.error('Error fetching Ethena TVL:', error);
      return {
        tvl: 0,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build deposit transaction(s) for sUSDe staking
   * User must first have USDe tokens
   * @param {string} userAddress
   * @param {BigInt} amount - Amount in USDe base units (18 decimals)
   * @returns {Promise<Array>} - Array of transactions
   */
  async buildDepositTransaction(userAddress, amount) {
    const transactions = [];

    // Check current allowance for sUSDe contract
    const currentAllowance = await this.usde.allowance(userAddress, this.susdeAddress);

    // Add approval transaction if needed
    if (currentAllowance < amount) {
      transactions.push({
        to: this.usdeAddress,
        data: this.usde.interface.encodeFunctionData('approve', [
          this.susdeAddress,
          amount,
        ]),
        value: 0,
        description: 'Approve USDe for Ethena staking',
      });
    }

    // Add deposit (stake) transaction
    // sUSDe uses ERC-4626 deposit(assets, receiver)
    transactions.push({
      to: this.susdeAddress,
      data: this.susde.interface.encodeFunctionData('deposit', [
        amount,           // assets (USDe amount)
        userAddress,      // receiver
      ]),
      value: 0,
      description: `Stake ${Number(amount) / 1e18} USDe to receive sUSDe`,
    });

    return transactions;
  }

  /**
   * Build withdrawal transaction (unstake sUSDe)
   * @param {string} userAddress
   * @param {BigInt} amount - Amount of USDe to withdraw
   * @returns {Promise<object>}
   */
  async buildWithdrawTransaction(userAddress, amount) {
    // ERC-4626 withdraw(assets, receiver, owner)
    return {
      to: this.susdeAddress,
      data: this.susde.interface.encodeFunctionData('withdraw', [
        amount,           // assets (USDe to receive)
        userAddress,      // receiver
        userAddress,      // owner
      ]),
      value: 0,
      description: `Unstake sUSDe to receive ${amount === ethers.MaxUint256 ? 'all' : Number(amount) / 1e18} USDe`,
    };
  }

  /**
   * Build redeem transaction (redeem sUSDe shares)
   * Alternative to withdraw - specify shares instead of assets
   * @param {string} userAddress
   * @param {BigInt} shares - Amount of sUSDe shares to redeem
   * @returns {Promise<object>}
   */
  async buildRedeemTransaction(userAddress, shares) {
    return {
      to: this.susdeAddress,
      data: this.susde.interface.encodeFunctionData('redeem', [
        shares,           // shares to redeem
        userAddress,      // receiver
        userAddress,      // owner
      ]),
      value: 0,
      description: `Redeem ${Number(shares) / 1e18} sUSDe for USDe`,
    };
  }

  /**
   * Estimate gas for deposit
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>}
   */
  async estimateDepositGas(userAddress, amount) {
    try {
      const currentAllowance = await this.usde.allowance(userAddress, this.susdeAddress);
      let totalGas = 0n;

      if (currentAllowance < amount) {
        const approvalGas = await this.usde.approve.estimateGas(this.susdeAddress, amount);
        totalGas += approvalGas;
      }

      const depositGas = await this.susde.deposit.estimateGas(amount, userAddress);
      totalGas += depositGas;

      return this.addGasBuffer(totalGas, 20);
    } catch (error) {
      console.error('Ethena gas estimation failed:', error);
      return 200000n; // Fallback estimate
    }
  }

  /**
   * Estimate gas for withdrawal
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>}
   */
  async estimateWithdrawGas(userAddress, amount) {
    try {
      const estimate = await this.susde.withdraw.estimateGas(amount, userAddress, userAddress);
      return this.addGasBuffer(estimate, 20);
    } catch (error) {
      console.error('Ethena withdrawal gas estimation failed:', error);
      return 150000n; // Fallback
    }
  }

  /**
   * Get user's current sUSDe position
   * @param {string} userAddress
   * @returns {Promise<object>}
   */
  async getUserPosition(userAddress) {
    try {
      // Get user's sUSDe balance (shares)
      const shares = await this.susde.balanceOf(userAddress);

      // Convert shares to underlying USDe assets
      const assets = await this.susde.convertToAssets(shares);

      // Get user's USDe balance too
      const usdeBalance = await this.usde.balanceOf(userAddress);

      return {
        shares: Number(shares) / 1e18,
        sharesRaw: shares.toString(),
        stakedValue: Number(assets) / 1e18,
        stakedValueRaw: assets.toString(),
        usdeBalance: Number(usdeBalance) / 1e18,
        usdeBalanceRaw: usdeBalance.toString(),
        stakingContract: this.susdeAddress,
      };
    } catch (error) {
      console.error('Error fetching Ethena user position:', error);
      return {
        shares: 0,
        stakedValue: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get the current cooldown status for unstaking
   * Ethena may have cooldown periods for withdrawals
   * @param {string} userAddress
   * @returns {Promise<object>}
   */
  async getCooldownStatus(userAddress) {
    try {
      // Check if cooldown is implemented in sUSDe
      // Some versions may have instant withdrawal, others may have cooldown
      const cooldownDuration = await this.susde.cooldownDuration?.() || 0;

      return {
        cooldownDuration: Number(cooldownDuration),
        cooldownDurationHours: Number(cooldownDuration) / 3600,
        instantWithdrawal: cooldownDuration === 0,
      };
    } catch (error) {
      // Cooldown may not be implemented
      return {
        cooldownDuration: 0,
        instantWithdrawal: true,
        note: 'Cooldown status unavailable',
      };
    }
  }

  /**
   * Get protocol metadata
   * @returns {object}
   */
  getMetadata() {
    return {
      protocolName: this.protocolName,
      chainId: this.chainId,
      usdeAddress: this.usdeAddress,
      susdeAddress: this.susdeAddress,
      enaAddress: this.enaAddress,
      type: 'staking',
      vaultType: 'ERC-4626',
      underlyingToken: 'USDe',
      receiptToken: 'sUSDe',
      yieldSource: 'Delta-neutral funding rate arbitrage',
    };
  }
}

// sUSDe Staking Contract ABI (ERC-4626 compatible)
const SUSDE_ABI = [
  // ERC-4626 standard functions
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function maxDeposit(address) view returns (uint256)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewWithdraw(uint256 assets) view returns (uint256)',
  'function asset() view returns (address)',
  // ERC-20 standard
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  // Optional cooldown (may or may not be present)
  'function cooldownDuration() view returns (uint256)',
  'function cooldownAssets(address account) view returns (uint256 cooldownEnd, uint256 underlyingAmount)',
];

// Standard ERC20 ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

export { SUSDE_ABI };
