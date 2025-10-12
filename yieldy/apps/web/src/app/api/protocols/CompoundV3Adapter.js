import { ethers, Contract } from 'ethers';
import { BaseAdapter } from './BaseAdapter.js';

/**
 * Compound V3 (Comet) Protocol Adapter
 * Fetches real on-chain data from Compound V3 USDC markets
 */
export class CompoundV3Adapter extends BaseAdapter {
  constructor(provider, chainId) {
    super(provider, chainId);
    this.protocolName = 'Compound V3';

    // Compound V3 Comet (USDC) addresses by chain
    this.cometAddresses = {
      1: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', // Ethereum cUSDCv3
      8453: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf', // Base cUSDbC
    };

    // USDC addresses
    this.usdcAddresses = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    };

    this.cometAddress = this.cometAddresses[chainId];
    this.usdcAddress = this.usdcAddresses[chainId];

    if (!this.cometAddress) {
      throw new Error(`Compound V3 not supported on chain ID ${chainId}`);
    }

    // Initialize contract interface
    this.comet = new Contract(this.cometAddress, COMET_ABI, provider);
    this.usdc = new Contract(this.usdcAddress, ERC20_ABI, provider);
  }

  /**
   * Get current supply APY
   * @returns {Promise<object>}
   */
  async getCurrentAPY() {
    try {
      // Get utilization rate
      const utilization = await this.comet.getUtilization();
      
      // Get supply rate
      const supplyRate = await this.comet.getSupplyRate(utilization);

      // Compound uses per-second rates, need to annualize
      // APY = (1 + ratePerSecond)^secondsPerYear - 1
      const secondsPerYear = 365.25 * 24 * 60 * 60;
      const ratePerSecond = Number(supplyRate) / 1e18;
      
      // For small rates, approximate: APY ≈ ratePerSecond * secondsPerYear
      const apy = ratePerSecond * secondsPerYear * 100;

      return {
        apy: Number(apy.toFixed(4)),
        utilization: Number(utilization) / 1e18,
        source: 'on-chain',
        timestamp: Date.now(),
        protocol: 'Compound V3',
        chain: this.chainId === 1 ? 'ethereum' : 'base',
      };
    } catch (error) {
      console.error('Error fetching Compound APY:', error);
      return {
        apy: 0,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get TVL (total supply in Comet)
   * @returns {Promise<object>}
   */
  async getTVL() {
    try {
      // Total supply is the TVL in Compound V3
      const totalSupply = await this.comet.totalSupply();

      // Compound V3 uses same decimals as base asset (6 for USDC)
      const tvl = Number(totalSupply) / 1e6;

      return {
        tvl,
        tvlFormatted: `$${tvl.toLocaleString()}`,
        source: 'on-chain',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching Compound TVL:', error);
      return {
        tvl: 0,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build deposit transaction
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<Array>}
   */
  async buildDepositTransaction(userAddress, amount) {
    const transactions = [];

    // Check allowance
    const currentAllowance = await this.usdc.allowance(userAddress, this.cometAddress);

    // Approval if needed
    if (currentAllowance < amount) {
      transactions.push({
        to: this.usdcAddress,
        data: this.usdc.interface.encodeFunctionData('approve', [
          this.cometAddress,
          amount,
        ]),
        value: 0,
        description: 'Approve USDC for Compound',
      });
    }

    // Supply transaction
    transactions.push({
      to: this.cometAddress,
      data: this.comet.interface.encodeFunctionData('supply', [
        this.usdcAddress,
        amount,
      ]),
      value: 0,
      description: `Deposit ${Number(amount) / 1e6} USDC to Compound`,
    });

    return transactions;
  }

  /**
   * Build withdrawal transaction
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<object>}
   */
  async buildWithdrawTransaction(userAddress, amount) {
    return {
      to: this.cometAddress,
      data: this.comet.interface.encodeFunctionData('withdraw', [
        this.usdcAddress,
        amount,
      ]),
      value: 0,
      description: `Withdraw ${Number(amount) / 1e6} USDC from Compound`,
    };
  }

  /**
   * Estimate deposit gas
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>}
   */
  async estimateDepositGas(userAddress, amount) {
    try {
      const currentAllowance = await this.usdc.allowance(userAddress, this.cometAddress);
      let totalGas = 0n;

      if (currentAllowance < amount) {
        const approvalGas = await this.usdc.approve.estimateGas(this.cometAddress, amount);
        totalGas += approvalGas;
      }

      const supplyGas = await this.comet.supply.estimateGas(this.usdcAddress, amount);
      totalGas += supplyGas;

      return this.addGasBuffer(totalGas, 20);
    } catch (error) {
      console.error('Compound gas estimation failed:', error);
      return 250000n;
    }
  }

  /**
   * Estimate withdrawal gas
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>}
   */
  async estimateWithdrawGas(userAddress, amount) {
    try {
      const estimate = await this.comet.withdraw.estimateGas(this.usdcAddress, amount);
      return this.addGasBuffer(estimate, 20);
    } catch (error) {
      console.error('Withdrawal gas estimation failed:', error);
      return 180000n;
    }
  }

  /**
   * Get user position
   * @param {string} userAddress
   * @returns {Promise<object>}
   */
  async getUserPosition(userAddress) {
    try {
      // In Compound V3, user balance is tracked in the Comet contract
      const balance = await this.comet.balanceOf(userAddress);
      const borrowBalance = await this.comet.borrowBalanceOf(userAddress);

      return {
        balance: Number(balance) / 1e6,
        balanceRaw: balance.toString(),
        borrowed: Number(borrowBalance) / 1e6,
        net: (Number(balance) - Number(borrowBalance)) / 1e6,
      };
    } catch (error) {
      console.error('Error fetching Compound position:', error);
      return {
        balance: 0,
        error: error.message,
      };
    }
  }
}

// Compound V3 Comet ABI (minimal interface)
const COMET_ABI = [
  'function supply(address asset, uint256 amount)',
  'function withdraw(address asset, uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
  'function borrowBalanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getSupplyRate(uint256 utilization) view returns (uint256)',
  'function getUtilization() view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

export { COMET_ABI, ERC20_ABI };

