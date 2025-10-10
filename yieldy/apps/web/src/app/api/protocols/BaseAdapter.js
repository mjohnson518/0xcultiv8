/**
 * Base Protocol Adapter
 * Abstract class defining standard interface for all protocol adapters
 */
export class BaseAdapter {
  constructor(provider, chainId) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly');
    }

    this.provider = provider;
    this.chainId = chainId;
    this.protocolName = 'Unknown';
  }

  /**
   * Get current APY for the protocol
   * @returns {Promise<object>} - { apy, source, timestamp }
   */
  async getCurrentAPY() {
    throw new Error('getCurrentAPY() must be implemented by subclass');
  }

  /**
   * Get Total Value Locked
   * @returns {Promise<object>} - { tvl, source, timestamp }
   */
  async getTVL() {
    throw new Error('getTVL() must be implemented by subclass');
  }

  /**
   * Build deposit transaction(s)
   * @param {string} userAddress - User depositing
   * @param {BigInt} amount - Amount to deposit (in token decimals)
   * @returns {Promise<Array>} - Array of transaction objects
   */
  async buildDepositTransaction(userAddress, amount) {
    throw new Error('buildDepositTransaction() must be implemented by subclass');
  }

  /**
   * Build withdrawal transaction
   * @param {string} userAddress - User withdrawing
   * @param {BigInt} amount - Amount to withdraw
   * @returns {Promise<object>} - Transaction object
   */
  async buildWithdrawTransaction(userAddress, amount) {
    throw new Error('buildWithdrawTransaction() must be implemented by subclass');
  }

  /**
   * Estimate gas for deposit
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>} - Estimated gas
   */
  async estimateDepositGas(userAddress, amount) {
    throw new Error('estimateDepositGas() must be implemented by subclass');
  }

  /**
   * Estimate gas for withdrawal
   * @param {string} userAddress
   * @param {BigInt} amount
   * @returns {Promise<BigInt>} - Estimated gas
   */
  async estimateWithdrawGas(userAddress, amount) {
    throw new Error('estimateWithdrawGas() must be implemented by subclass');
  }

  /**
   * Simulate transaction to check if it will succeed
   * @param {object} transaction - Transaction to simulate
   * @param {string} fromAddress - Address simulating from
   * @returns {Promise<boolean>} - True if will succeed
   */
  async simulateTransaction(transaction, fromAddress) {
    try {
      await this.provider.call({
        ...transaction,
        from: fromAddress,
      });
      return true;
    } catch (error) {
      console.error(`Transaction simulation failed for ${this.protocolName}:`, error.message);
      return false;
    }
  }

  /**
   * Get user's current position in this protocol
   * @param {string} userAddress
   * @returns {Promise<object>} - Position details
   */
  async getUserPosition(userAddress) {
    throw new Error('getUserPosition() must be implemented by subclass');
  }

  /**
   * Helper to add buffer to gas estimates
   * @param {BigInt} estimate
   * @param {number} bufferPercent - Buffer percentage (default 20%)
   * @returns {BigInt}
   */
  addGasBuffer(estimate, bufferPercent = 20) {
    return (estimate * BigInt(100 + bufferPercent)) / 100n;
  }
}

