import { useState, useEffect } from 'react';

/**
 * Hook to manage dark mode state
 * - Reads from localStorage
 * - Applies .dark or .light class to document.documentElement
 * - Returns [isDark, toggleDark]
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage on initial load
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) {
        return stored === 'true';
      }
      // Default to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Remove both classes first
    html.classList.remove('dark', 'light');
    body.classList.remove('dark', 'light');
    
    // Apply the appropriate class
    if (isDark) {
      html.classList.add('dark');
      body.classList.add('dark');
    } else {
      html.classList.add('light');
      body.classList.add('light');
    }
    
    // Save to localStorage
    localStorage.setItem('darkMode', isDark.toString());
    
    console.log('Dark mode:', isDark ? 'ON' : 'OFF'); // Debug log
  }, [isDark]);

  const toggleDark = () => {
    console.log('Toggling dark mode from', isDark, 'to', !isDark);
    setIsDark(!isDark);
  };

  return [isDark, toggleDark];
}

