import { ethers, Contract } from 'ethers';
import { BaseAdapter } from './BaseAdapter.js';

/**
 * Aave V3 Protocol Adapter
 * Fetches real on-chain data from Aave V3 lending pools
 */
export class AaveV3Adapter extends BaseAdapter {
  constructor(provider, chainId) {
    super(provider, chainId);
    this.protocolName = 'Aave V3';

    // Aave V3 Pool addresses by chain
    this.poolAddresses = {
      1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum Mainnet
      8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Base
    };

    // USDC addresses by chain
    this.usdcAddresses = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',     // Ethereum
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    };

    this.poolAddress = this.poolAddresses[chainId];
    this.usdcAddress = this.usdcAddresses[chainId];

    if (!this.poolAddress || !this.usdcAddress) {
      throw new Error(`Aave V3 not supported on chain ID ${chainId}`);
    }

    // Initialize contract interfaces
    this.pool = new Contract(this.poolAddress, AAVE_POOL_ABI, provider);
    this.usdc = new Contract(this.usdcAddress, ERC20_ABI, provider);
  }

  /**
   * Get current supply APY for USDC
   * @returns {Promise<object>}
   */
  async getCurrentAPY() {
    try {
      const reserveData = await this.pool.getReserveData(this.usdcAddress);

      // Aave stores rates as "ray" (27 decimals, 1e27 = 100%)
      // currentLiquidityRate is the supply APR in ray
      const supplyRateRay = reserveData.currentLiquidityRate;
      const supplyAPR = Number(supplyRateRay) / 1e27;

      // Convert APR to APY using compound interest formula
      // APY = (1 + APR/365)^365 - 1, but for simplicity we approximate
      const supplyAPY = supplyAPR * 100; // Convert to percentage

      return {
        apy: Number(supplyAPY.toFixed(4)),
        apr: Number(supplyAPR.toFixed(4)) * 100,
        source: 'on-chain',
        timestamp: Date.now(),
        protocol: 'Aave V3',
        chain: this.chainId === 1 ? 'ethereum' : 'base',
      };
    } catch (error) {
      console.error('Error fetching Aave APY:', error);
      return {
        apy: 0,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get Total Value Locked in USDC pool
   * @returns {Promise<object>}
   */
  async getTVL() {
    try {
      const reserveData = await this.pool.getReserveData(this.usdcAddress);

      // Get aToken address (aUSDC)
      const aTokenAddress = reserveData.aTokenAddress;
      const aToken = new Contract(aTokenAddress, ERC20_ABI, this.provider);

      // Total supply of aTokens = TVL
      const totalSupply = await aToken.totalSupply();

      // USDC has 6 decimals
      const tvlUSDC = Number(totalSupply) / 1e6;

      return {
        tvl: tvlUSDC,
        tvlFormatted: `$${tvlUSDC.toLocaleString()}`,
        source: 'on-chain',
        timestamp: Date.now(),
        aTokenAddress,
      };
    } catch (error) {
      console.error('Error fetching Aave TVL:', error);
      return {
        tvl: 0,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build deposit transaction(s)
   * @param {string} userAddress
   * @param {BigInt} amount - Amount in USDC base units (6 decimals)
   * @returns {Promise<Array>} - Array of transactions
   */
  async buildDepositTransaction(userAddress, amount) {
    const transactions = [];

    // Check current allowance
    const currentAllowance = await this.usdc.allowance(userAddress, this.poolAddress);

    // Add approval transaction if needed
    if (currentAllowance < amount) {
      transactions.push({
        to: this.usdcAddress,
        data: this.usdc.interface.encodeFunctionData('approve', [
          this.poolAddress,
          amount,
        ]),
        value: 0,
        description: 'Approve USDC for Aave',
      });
    }

    // Add supply transaction
    transactions.push({
      to: this.poolAddress,
      data: this.pool.interface.encodeFunctionData('supply', [
        this.usdcAddress, // asset
        amount,           // amount
        userAddress,      // onBehalfOf
        0,                // referralCode
      ]),
      value: 0,
      description: `Deposit ${Number(amount) / 1e6} USDC to Aave`,
    });

    return transactions;
  }

  /**
   * Build withdrawal transaction
   * @param {string} userAddress
   * @param {BigInt} amount - Amount to withdraw (use type(uint256).max for full withdrawal)
   * @returns {Promise<object>}
   */
  async buildWithdrawTransaction(userAddress, amount) {
    return {
      to: this.poolAddress,
      data: this.pool.interface.encodeFunctionData('withdraw', [
        this.usdcAddress, // asset
        amount,           // amount
        userAddress,      // to
      ]),
      value: 0,
      description: `Withdraw ${amount === ethers.MaxUint256 ? 'all' : Number(amount) / 1e6} USDC from Aave`,
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
      // Check if approval needed
      const currentAllowance = await this.usdc.allowance(userAddress, this.poolAddress);
      let totalGas = 0n;

      if (currentAllowance < amount) {
        // Estimate approval gas
        const approvalGas = await this.usdc.approve.estimateGas(this.poolAddress, amount);
        totalGas += approvalGas;
      }

      // Estimate supply gas
      const supplyGas = await this.pool.supply.estimateGas(
        this.usdcAddress,
        amount,
        userAddress,
        0
      );
      totalGas += supplyGas;

      // Add 20% buffer
      return this.addGasBuffer(totalGas, 20);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return 300000n; // Fallback estimate
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
      const estimate = await this.pool.withdraw.estimateGas(
        this.usdcAddress,
        amount,
        userAddress
      );
      return this.addGasBuffer(estimate, 20);
    } catch (error) {
      console.error('Withdrawal gas estimation failed:', error);
      return 200000n; // Fallback
    }
  }

  /**
   * Get user's current position (aUSDC balance)
   * @param {string} userAddress
   * @returns {Promise<object>}
   */
  async getUserPosition(userAddress) {
    try {
      const accountData = await this.pool.getUserAccountData(userAddress);
      
      // Get aToken balance
      const reserveData = await this.pool.getReserveData(this.usdcAddress);
      const aToken = new Contract(reserveData.aTokenAddress, ERC20_ABI, this.provider);
      const balance = await aToken.balanceOf(userAddress);

      return {
        balance: Number(balance) / 1e6,
        balanceRaw: balance.toString(),
        totalCollateral: Number(accountData.totalCollateralBase) / 1e8,
        totalDebt: Number(accountData.totalDebtBase) / 1e8,
        availableBorrows: Number(accountData.availableBorrowsBase) / 1e8,
        healthFactor: Number(accountData.healthFactor) / 1e18,
      };
    } catch (error) {
      console.error('Error fetching user position:', error);
      return {
        balance: 0,
        error: error.message,
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
      poolAddress: this.poolAddress,
      usdcAddress: this.usdcAddress,
      type: 'lending',
    };
  }
}

// Aave V3 Pool ABI (minimal interface)
const AAVE_POOL_ABI = [
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// Standard ERC20 ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export { AAVE_POOL_ABI, ERC20_ABI };

