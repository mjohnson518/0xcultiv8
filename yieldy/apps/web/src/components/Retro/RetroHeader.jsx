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
 * />
 */

export function RetroHeader({
  walletAddress,
  isConnected = false,
  onConnect,
  currentPage = '',
  navigation = [],
  className = '',
}) {
  // Truncate wallet address
  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className={`border-b-2 border-black bg-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Top Row: Logo and Connection */}
        <div className="flex items-center justify-between mb-3">
          {/* ASCII Logo */}
          <div className="font-pixel text-xs leading-tight hidden md:block">
            <pre className="text-black select-none" style={{ lineHeight: '1' }}>
{` ██████╗██╗   ██╗██╗  ████████╗██╗██╗   ██╗ █████╗ 
██╔════╝██║   ██║██║  ╚══██╔══╝██║██║   ██║██╔══██╗
██║     ██║   ██║██║     ██║   ██║██║   ██║╚█████╔╝
╚██████╗╚██████╔╝███████╗██║   ██║ ╚████╔╝ ╚█████╔╝`}
            </pre>
          </div>

          {/* Mobile Logo */}
          <div className="md:hidden font-display text-lg">
            CULTIV8
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            <div className="font-mono text-sm flex items-center space-x-2">
              <span className={isConnected ? 'text-green-500' : 'text-gray-500'}>
                {isConnected ? '[●LIVE]' : '[○OFFLINE]'}
              </span>
              {walletAddress && (
                <span className="hidden sm:inline text-xs">
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
                  border-2 border-black
                  font-mono text-sm uppercase
                  transition-none
                  ${item.active || currentPage === item.label.toLowerCase()
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-gray-200'
                  }
                  focus-visible:outline focus-visible:outline-3 focus-visible:outline-black
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

