'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract, BrowserProvider } from 'ethers';
import { CULTIV8_AGENT_ABI, AGENT_VAULT_ABI, ERC20_ABI } from '@/contracts/abis';
import { getContractAddresses, areContractsDeployed } from '@/contracts/addresses';
import { isDemoModeEnabled } from '@/utils/demoMode';

/**
 * Hook for managing Cultiv8 Agent on-chain authorization
 *
 * Provides:
 * - Authorization status checking
 * - Agent authorization with spending limits
 * - USDC approval management
 * - Vault deposit/withdrawal
 * - Authorization revocation
 */
export function useAgentAuthorization() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [userAddress, setUserAddress] = useState(null);

  // Authorization state
  const [authorization, setAuthorization] = useState(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [usdcAllowance, setUsdcAllowance] = useState(0);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Contract instances
  const [contracts, setContracts] = useState({
    agent: null,
    vault: null,
    usdc: null,
  });

  /**
   * Initialize provider and contracts
   */
  const initialize = useCallback(async () => {
    // Demo mode - return mock state
    if (isDemoModeEnabled()) {
      setAuthorization({
        active: false,
        agent: ethers.ZeroAddress,
        maxAmountPerTx: 0,
        dailyLimit: 0,
        dailySpent: 0,
        remainingDaily: 0,
      });
      return;
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const browserProvider = new BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();
      const currentChainId = Number(network.chainId);

      setProvider(browserProvider);
      setChainId(currentChainId);

      // Check if contracts are deployed on this chain
      if (!areContractsDeployed(currentChainId)) {
        setError(`Contracts not deployed on chain ${currentChainId}. Please switch to a supported network.`);
        setIsLoading(false);
        return;
      }

      const addresses = getContractAddresses(currentChainId);

      // Get signer if connected
      try {
        const walletSigner = await browserProvider.getSigner();
        const address = await walletSigner.getAddress();
        setSigner(walletSigner);
        setUserAddress(address);

        // Initialize contract instances with signer
        const agentContract = new Contract(addresses.cultiv8Agent, CULTIV8_AGENT_ABI, walletSigner);
        const vaultContract = new Contract(addresses.agentVault, AGENT_VAULT_ABI, walletSigner);
        const usdcContract = new Contract(addresses.usdc, ERC20_ABI, walletSigner);

        setContracts({
          agent: agentContract,
          vault: vaultContract,
          usdc: usdcContract,
        });

        // Fetch current state
        await refreshState(agentContract, vaultContract, usdcContract, address, addresses);
      } catch (signerError) {
        console.log('Wallet not connected yet');
      }
    } catch (err) {
      console.error('Initialization error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh on-chain state
   */
  const refreshState = async (agentContract, vaultContract, usdcContract, address, addresses) => {
    try {
      // Get authorization status
      const auth = await agentContract.getAuthorization(address);
      const remainingDaily = await agentContract.getRemainingDailyLimit(address);

      setAuthorization({
        active: auth.active,
        agent: auth.agent,
        maxAmountPerTx: Number(auth.maxAmountPerTx) / 1e6, // Convert from 6 decimals
        dailyLimit: Number(auth.dailyLimit) / 1e6,
        dailySpent: Number(auth.dailySpent) / 1e6,
        remainingDaily: Number(remainingDaily) / 1e6,
        authorizedAt: auth.active ? new Date(Number(auth.authorizedAt) * 1000) : null,
      });

      // Get vault balance
      const vaultBal = await vaultContract.balanceOf(address);
      setVaultBalance(Number(vaultBal) / 1e6);

      // Get USDC balance and allowance
      const usdcBal = await usdcContract.balanceOf(address);
      const allowance = await usdcContract.allowance(address, addresses.agentVault);

      setUsdcBalance(Number(usdcBal) / 1e6);
      setUsdcAllowance(Number(allowance) / 1e6);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  };

  /**
   * Authorize the Cultiv8 agent with spending limits
   * @param {number} maxPerTx - Maximum USD per transaction
   * @param {number} dailyLimit - Maximum USD per day
   */
  const authorizeAgent = async (maxPerTx, dailyLimit) => {
    if (isDemoModeEnabled()) {
      // Demo mode simulation
      setAuthorization({
        active: true,
        agent: '0xCultiv8Agent',
        maxAmountPerTx: maxPerTx,
        dailyLimit: dailyLimit,
        dailySpent: 0,
        remainingDaily: dailyLimit,
        authorizedAt: new Date(),
      });
      return { success: true, demo: true };
    }

    if (!contracts.agent || !signer) {
      throw new Error('Contracts not initialized. Please connect your wallet.');
    }

    try {
      setIsLoading(true);
      setError(null);

      const addresses = getContractAddresses(chainId);

      // Convert to USDC decimals (6)
      const maxPerTxBN = ethers.parseUnits(maxPerTx.toString(), 6);
      const dailyLimitBN = ethers.parseUnits(dailyLimit.toString(), 6);

      // Get the agent backend address (should be configured)
      const agentBackendAddress = process.env.NEXT_PUBLIC_AGENT_BACKEND_ADDRESS ||
        addresses.cultiv8Agent; // Fallback to contract address

      // Send authorization transaction
      const tx = await contracts.agent.authorizeAgent(
        agentBackendAddress,
        maxPerTxBN,
        dailyLimitBN
      );

      // Wait for confirmation
      const receipt = await tx.wait();

      // Refresh state
      await refreshState(contracts.agent, contracts.vault, contracts.usdc, userAddress, addresses);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      console.error('Authorization error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Revoke agent authorization
   */
  const revokeAuthorization = async () => {
    if (isDemoModeEnabled()) {
      setAuthorization({
        active: false,
        agent: ethers.ZeroAddress,
        maxAmountPerTx: 0,
        dailyLimit: 0,
        dailySpent: 0,
        remainingDaily: 0,
      });
      return { success: true, demo: true };
    }

    if (!contracts.agent || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const tx = await contracts.agent.revokeAgent();
      const receipt = await tx.wait();

      const addresses = getContractAddresses(chainId);
      await refreshState(contracts.agent, contracts.vault, contracts.usdc, userAddress, addresses);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (err) {
      console.error('Revocation error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update spending limits
   * @param {number} maxPerTx - New maximum per transaction
   * @param {number} dailyLimit - New daily limit
   */
  const updateLimits = async (maxPerTx, dailyLimit) => {
    if (isDemoModeEnabled()) {
      setAuthorization(prev => ({
        ...prev,
        maxAmountPerTx: maxPerTx,
        dailyLimit: dailyLimit,
        remainingDaily: dailyLimit - (prev?.dailySpent || 0),
      }));
      return { success: true, demo: true };
    }

    if (!contracts.agent || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const maxPerTxBN = ethers.parseUnits(maxPerTx.toString(), 6);
      const dailyLimitBN = ethers.parseUnits(dailyLimit.toString(), 6);

      const tx = await contracts.agent.updateLimits(maxPerTxBN, dailyLimitBN);
      const receipt = await tx.wait();

      const addresses = getContractAddresses(chainId);
      await refreshState(contracts.agent, contracts.vault, contracts.usdc, userAddress, addresses);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (err) {
      console.error('Update limits error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Approve USDC spending for vault
   * @param {number} amount - Amount to approve in USD
   */
  const approveUsdc = async (amount) => {
    if (isDemoModeEnabled()) {
      setUsdcAllowance(amount);
      return { success: true, demo: true };
    }

    if (!contracts.usdc || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const addresses = getContractAddresses(chainId);
      const amountBN = ethers.parseUnits(amount.toString(), 6);

      const tx = await contracts.usdc.approve(addresses.agentVault, amountBN);
      const receipt = await tx.wait();

      // Update allowance
      const newAllowance = await contracts.usdc.allowance(userAddress, addresses.agentVault);
      setUsdcAllowance(Number(newAllowance) / 1e6);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (err) {
      console.error('Approval error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Deposit USDC into vault
   * @param {number} amount - Amount to deposit in USD
   */
  const depositToVault = async (amount) => {
    if (isDemoModeEnabled()) {
      setVaultBalance(prev => prev + amount);
      return { success: true, demo: true };
    }

    if (!contracts.vault || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const amountBN = ethers.parseUnits(amount.toString(), 6);

      // Check allowance first
      const addresses = getContractAddresses(chainId);
      const allowance = await contracts.usdc.allowance(userAddress, addresses.agentVault);

      if (allowance < amountBN) {
        throw new Error(`Insufficient USDC allowance. Please approve at least $${amount}`);
      }

      const tx = await contracts.vault.deposit(amountBN);
      const receipt = await tx.wait();

      // Refresh balances
      await refreshState(contracts.agent, contracts.vault, contracts.usdc, userAddress, addresses);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (err) {
      console.error('Deposit error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Withdraw USDC from vault
   * @param {number} amount - Amount to withdraw in USD
   */
  const withdrawFromVault = async (amount) => {
    if (isDemoModeEnabled()) {
      setVaultBalance(prev => Math.max(0, prev - amount));
      return { success: true, demo: true };
    }

    if (!contracts.vault || !signer) {
      throw new Error('Contracts not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const amountBN = ethers.parseUnits(amount.toString(), 6);

      const tx = await contracts.vault.withdraw(amountBN);
      const receipt = await tx.wait();

      const addresses = getContractAddresses(chainId);
      await refreshState(contracts.agent, contracts.vault, contracts.usdc, userAddress, addresses);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initialize();

    // Listen for account/chain changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', initialize);
      window.ethereum.on('chainChanged', initialize);

      return () => {
        window.ethereum.removeListener('accountsChanged', initialize);
        window.ethereum.removeListener('chainChanged', initialize);
      };
    }
  }, [initialize]);

  return {
    // State
    authorization,
    vaultBalance,
    usdcBalance,
    usdcAllowance,
    chainId,
    userAddress,
    isLoading,
    error,
    isContractsDeployed: chainId ? areContractsDeployed(chainId) : false,

    // Actions
    authorizeAgent,
    revokeAuthorization,
    updateLimits,
    approveUsdc,
    depositToVault,
    withdrawFromVault,
    refresh: initialize,
  };
}
