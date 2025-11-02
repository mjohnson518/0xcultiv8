'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext({
  walletAddress: null,
  isConnected: false,
  connectWallet: () => {},
  disconnectWallet: () => {},
});

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectWallet = async () => {
    // Demo mode - instant connection
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || typeof window.ethereum === 'undefined') {
      const demoAddress = '0xDemo' + Math.random().toString(16).substr(2, 38);
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
        // Fallback to demo
        const demoAddress = '0xDemo' + Math.random().toString(16).substr(2, 38);
        setWalletAddress(demoAddress);
        setIsConnected(true);
        return demoAddress;
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

