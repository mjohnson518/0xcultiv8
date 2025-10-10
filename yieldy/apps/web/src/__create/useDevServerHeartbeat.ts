'use client';

import { useEffect } from 'react';

export function useDevServerHeartbeat() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;
    let lastAction = Date.now();

    const heartbeat = () => {
      fetch('/', {
        method: 'GET',
      }).catch((error) => {
        // this is a no-op, we just want to keep the dev server alive
      });
    };

    const handleActivity = () => {
      const now = Date.now();
      // Throttle: only trigger if it's been at least 3 minutes since last action
      if (now - lastAction >= 60_000 * 3) {
        lastAction = now;
        heartbeat();
      }
      
      // Reset timeout
      clearTimeout(timeoutId);
      timeoutId = setTimeout(heartbeat, 60_000);
    };

    // Set up event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Initial timeout
    timeoutId = setTimeout(heartbeat, 60_000);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);
}
