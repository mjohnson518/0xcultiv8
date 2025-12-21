'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { isDemoModeEnabled, getDemoWalletAddress, isProductionEnvironment } from '@/utils/demoMode';

const WalletContext = createContext({
  walletAddress: null,
  isConnected: false,
  connectWallet: () => {},
  disconnectWallet: () => {},
});

/**
 * Generate a consistent demo wallet address using crypto API
 * Falls back to a fixed demo address if crypto is unavailable
 */
function generateDemoAddress() {
  // Use a consistent demo address in demo mode
  const baseAddress = getDemoWalletAddress();
  if (baseAddress) {
    return baseAddress;
  }

  // Fallback: generate a random demo address using crypto API
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(20);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return '0xDemo' + hex.slice(0, 36);
  }

  // Last resort fallback (should not reach here)
  return '0xDemo0000000000000000000000000000000001';
}

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = async () => {
    // Demo mode - instant connection (only if safely enabled)
    if (isDemoModeEnabled() || typeof window.ethereum === 'undefined') {
      // In production without MetaMask, prompt user to install wallet
      if (isProductionEnvironment() && typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet to connect.');
        return null;
      }

      const demoAddress = generateDemoAddress();
      setWalletAddress(demoAddress);
      setIsConnected(true);
      localStorage.setItem('walletAddress', demoAddress);
      console.log('Demo wallet connected:', demoAddress);
      return demoAddress;
    }

    // Real wallet connection
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        localStorage.setItem('walletAddress', accounts[0]);
        console.log('Wallet connected:', accounts[0]);
        return accounts[0];
      } catch (error) {
        console.error('Wallet connection failed:', error);
        // Only fallback to demo if not in production
        if (!isProductionEnvironment()) {
          const demoAddress = generateDemoAddress();
          setWalletAddress(demoAddress);
          setIsConnected(true);
          return demoAddress;
        }
        // In production, show error to user
        alert('Wallet connection failed. Please try again.');
        return null;
      }
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setIsConnected(false);
    localStorage.removeItem('walletAddress');
    console.log('Wallet disconnected');
  };

  useEffect(() => {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      setWalletAddress(saved);
      setIsConnected(true);
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      walletAddress,
      isConnected,
      connectWallet,
      disconnectWallet,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);

