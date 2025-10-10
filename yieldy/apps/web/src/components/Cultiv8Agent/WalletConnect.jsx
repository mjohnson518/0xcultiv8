import React, { useState, useEffect } from 'react';
import { Wallet, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

export function WalletConnect({ onWalletConnected, onBalanceUpdate }) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Mock balances for demo purposes
  const mockBalances = {
    USDC: '2,547.83',
    USDT: '1,234.56',
    DAI: '5,678.90',
    ETH: '1.2345'
  };

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          await updateBalance(accounts[0]);
          await updateChainId();
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        await updateBalance(accounts[0]);
        await updateChainId();
        
        if (onWalletConnected) {
          onWalletConnected(accounts[0]);
        }
      }
    } catch (err) {
      if (err.code === 4001) {
        setError('Connection rejected by user');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
      console.error('Error connecting wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const updateBalance = async (account) => {
    try {
      // In a real implementation, you would fetch actual balances
      // For demo purposes, we'll use mock data
      const balanceData = mockBalances;
      setBalance(balanceData);
      
      if (onBalanceUpdate) {
        onBalanceUpdate(balanceData);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const updateChainId = async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(chainId);
    } catch (err) {
      console.error('Error fetching chain ID:', err);
    }
  };

  const switchNetwork = async (targetChainId) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        // Network not added to wallet
        if (targetChainId === '0x2105') { // Base mainnet
          await addBaseNetwork();
        }
      }
      console.error('Error switching network:', err);
    }
  };

  const addBaseNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x2105',
          chainName: 'Base',
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } catch (err) {
      console.error('Error adding Base network:', err);
    }
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case '0x1': return 'Ethereum';
      case '0x2105': return 'Base';
      default: return 'Unknown Network';
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAccount('');
    setBalance(null);
    setChainId(null);
    setError('');
  };

  if (isConnected) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Wallet Connected</h3>
              <p className="text-sm text-gray-500">
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={disconnectWallet}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Disconnect
          </button>
        </div>

        {chainId && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Network: {getNetworkName(chainId)}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => switchNetwork('0x1')}
                  className={`px-3 py-1 text-xs rounded ${
                    chainId === '0x1' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Ethereum
                </button>
                <button
                  onClick={() => switchNetwork('0x2105')}
                  className={`px-3 py-1 text-xs rounded ${
                    chainId === '0x2105' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Base
                </button>
              </div>
            </div>
          </div>
        )}

        {balance && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Available Balances</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(balance).map(([token, amount]) => (
                <div key={token} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{token}</span>
                    <span className="text-sm text-gray-600">{amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <a
            href={`https://etherscan.io/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            View on Explorer
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-blue-600" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Connect Your Wallet
        </h3>
        
        <p className="text-sm text-gray-500 mb-6">
          Connect your wallet to view balances and start earning yield on your USDC
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>

        <div className="mt-4 text-xs text-gray-400">
          Supports MetaMask, WalletConnect, and other Web3 wallets
        </div>
      </div>
    </div>
  );
}