import { RetroButton } from './RetroButton';

/**
 * RetroHeader Component
 * Terminal-style header with ASCII logo and navigation
 * 
 * @example
 * <RetroHeader
 *   walletAddress="0x742d35Cc..."
 *   isConnected={true}
 *   navigation={[{ label: 'DASHBOARD', href: '/', active: true }]}
 *   isDark={false}
 *   onToggleDark={() => {}}
 * />
 */

export function RetroHeader({
  walletAddress,
  isConnected = false,
  onConnect,
  currentPage = '',
  navigation = [],
  className = '',
  isDark = false,
  onToggleDark,
}) {
  // Truncate wallet address
  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className={`border-b-2 border-retro-black bg-retro-bg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Top Row: Logo and Connection */}
        <div className="flex items-center justify-between mb-3">
          {/* ASCII Logo */}
          <div className="font-pixel text-xs leading-tight hidden md:block">
            <pre className="text-retro-fg select-none" style={{ lineHeight: '1' }}>
{`
  ██████╗ ██╗   ██╗ ██╗   ██╗ ████████╗ ██╗██╗   ██╗  █████╗ 
 ██╔════╝ ██║   ██║ ██║   ██║ ╚══██╔══╝ ██║██║   ██║ ██╔══██╗
 ██║      ██║   ██║ ██║   ██║    ██║    ██║██║   ██║ ███████║
 ██║      ██║   ██║ ██║   ██║    ██║    ██║██║   ██║ ██╔══██║
 ╚██████╗ ╚██████╔╝ ╚██████╔╝    ██║    ██║╚██████╔╝ ██████╔╝
  ╚═════╝  ╚═════╝   ╚═════╝     ╚═╝    ╚═╝ ╚═════╝  ╚═════╝
`}
            </pre>
          </div>

          {/* Mobile Logo */}
          <div className="md:hidden font-display text-lg text-retro-fg">
            CULTIV8
          </div>

          {/* Right Side: Dark Mode Toggle + Connection Status */}
          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            {onToggleDark && (
              <button
                onClick={onToggleDark}
                className="px-3 py-1 border-2 border-retro-black bg-retro-bg font-mono text-xs uppercase hover:bg-retro-gray-100 transition-none"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? '[◐DARK]' : '[○LIGHT]'}
              </button>
            )}
            
            {/* Connection Status */}
            <div className="font-mono text-sm flex items-center space-x-2">
              <span className={isConnected ? 'text-retro-green' : 'text-retro-gray-500'}>
                {isConnected ? '[●LIVE]' : '[○OFFLINE]'}
              </span>
              {walletAddress && (
                <span className="hidden sm:inline text-xs text-retro-fg">
                  {truncateAddress(walletAddress)}
                </span>
              )}
            </div>
            {!isConnected && onConnect && (
              <RetroButton onClick={onConnect} size="small" variant="primary">
                CONNECT
              </RetroButton>
            )}
          </div>
        </div>

        {/* Navigation */}
        {navigation.length > 0 && (
          <nav className="flex flex-wrap gap-2" role="navigation">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`
                  px-4 py-2
                  border-2 border-retro-black
                  font-mono text-sm uppercase
                  transition-none
                  ${item.active || currentPage === item.label.toLowerCase()
                    ? 'bg-retro-black text-retro-white'
                    : 'bg-retro-bg text-retro-fg hover:bg-retro-gray-100'
                  }
                  focus-visible:outline focus-visible:outline-3 focus-visible:outline-retro-black
                `}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

