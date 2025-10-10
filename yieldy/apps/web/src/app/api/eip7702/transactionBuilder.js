import { ethers } from 'ethers';

/**
 * EIP-7702 Transaction Builder
 * Builds transactions that temporarily delegate EOA code to agent contract
 * 
 * EIP-7702 allows EOAs to act as smart contracts for single transactions
 * This enables gas less operations and batch transactions without deploying a smart wallet
 */
export class EIP7702TransactionBuilder {
  constructor(provider, agentContractAddress, vaultAddress) {
    this.provider = provider;
    this.agentAddress = agentContractAddress;
    this.vaultAddress = vaultAddress;
  }

  /**
   * Build EIP-7702 authorization for user to delegate to agent
   * @param {string} userAddress - User's EOA address
   * @param {number} nonce - Transaction nonce
   * @returns {Promise<object>} - Authorization structure
   */
  async buildAuthorization(userAddress, nonce) {
    const chainId = (await this.provider.getNetwork()).chainId;

    // EIP-7702 authorization format
    const authorization = {
      chainId: Number(chainId),
      address: this.agentAddress, // Temporarily delegate to this contract
      nonce: nonce,
    };

    return authorization;
  }

  /**
   * Build complete EIP-7702 delegated transaction
   * @param {object} params - Transaction parameters
   * @param {string} params.userAddress - User's address
   * @param {string} params.targetProtocol - Protocol to interact with
   * @param {string} params.strategyCalldata - Encoded strategy data
   * @param {BigInt} params.amount - Amount involved
   * @param {Wallet} params.userWallet - User's wallet for signing (optional for frontend)
   * @returns {Promise<object>} - Complete transaction object
   */
  async buildDelegatedTransaction({
    userAddress,
    targetProtocol,
    strategyCalldata,
    amount,
    userWallet = null
  }) {
    const nonce = await this.provider.getTransactionCount(userAddress);
    const authorization = await this.buildAuthorization(userAddress, nonce);

    // User must sign the authorization
    let authSignature = null;
    if (userWallet) {
      authSignature = await this.signAuthorization(authorization, userWallet);
    }

    // Build the transaction
    const feeData = await this.provider.getFeeData();

    // EIP-7702 type is 0x04
    const tx = {
      type: 4, // EIP-7702 transaction type
      chainId: authorization.chainId,
      nonce: nonce,
      to: targetProtocol,
      value: 0,
      data: strategyCalldata,
      gasLimit: 500000, // Will be estimated
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    };

    // Add authorization list if signature available
    if (authSignature) {
      tx.authorizationList = [
        {
          ...authorization,
          ...authSignature
        }
      ];
    } else {
      // Return unsigned transaction for frontend signing
      tx.authorization = authorization;
    }

    return tx;
  }

  /**
   * Sign EIP-7702 authorization
   * @param {object} authorization - Authorization object
   * @param {Wallet} userWallet - User's wallet for signing
   * @returns {Promise<object>} - Signature components (v, r, s)
   */
  async signAuthorization(authorization, userWallet) {
    // EIP-7702 specifies specific signing format
    // Domain: EIP-7702 Authorization
    const domain = {
      name: 'EIP-7702 Authorization',
      version: '1',
      chainId: authorization.chainId,
    };

    const types = {
      Authorization: [
        { name: 'chainId', type: 'uint256' },
        { name: 'address', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ]
    };

    const value = {
      chainId: authorization.chainId,
      address: authorization.address,
      nonce: authorization.nonce,
    };

    // Sign using EIP-712
    const signature = await userWallet.signTypedData(domain, types, value);
    const sig = ethers.Signature.from(signature);

    return {
      v: sig.v,
      r: sig.r,
      s: sig.s
    };
  }

  /**
   * Execute strategy using EIP-7702 delegation
   * @param {object} strategy - Strategy details
   * @param {Wallet} userWallet - User's wallet
   * @returns {Promise<object>} - Transaction receipt
   */
  async executeWithDelegation(strategy, userWallet) {
    const userAddress = await userWallet.getAddress();

    const tx = await this.buildDelegatedTransaction({
      userAddress,
      targetProtocol: strategy.protocolAddress,
      strategyCalldata: strategy.calldata,
      amount: strategy.amount,
      userWallet
    });

    // User signs the complete transaction
    const signedTx = await userWallet.signTransaction(tx);

    // Broadcast to network
    const response = await this.provider.broadcastTransaction(signedTx);
    const receipt = await response.wait();

    return receipt;
  }

  /**
   * Estimate gas for delegated transaction
   * @param {object} strategy - Strategy to estimate
   * @returns {Promise<BigInt>} - Estimated gas
   */
  async estimateGas(strategy) {
    try {
      const estimate = await this.provider.estimateGas({
        to: strategy.protocolAddress,
        data: strategy.calldata,
        from: strategy.userAddress
      });

      // Add buffer for delegation overhead  
      return estimate * 120n / 100n; // 20% buffer
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return 500000n; // Fallback
    }
  }

  /**
   * Build transaction for frontend (unsigned)
   * Frontend will handle signing via wallet provider (MetaMask, etc.)
   * @param {object} params - Transaction parameters
   * @returns {Promise<object>} - Unsigned transaction ready for frontend signing
   */
  async buildUnsignedTransaction(params) {
    const tx = await this.buildDelegatedTransaction({
      ...params,
      userWallet: null // No wallet, return unsigned
    });

    // Estimate gas
    const gasEstimate = await this.estimateGas(params);
    tx.gasLimit = gasEstimate;

    return {
      transaction: tx,
      requiresAuthorization: true,
      authorizationData: tx.authorization,
    };
  }
}

