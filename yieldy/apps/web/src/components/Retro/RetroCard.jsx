import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * RetroCard Component
 * Windows 95-style card with title bar and ASCII decorations
 * 
 * @example
 * <RetroCard title="SYSTEM STATUS" status="OPERATIONAL">
 *   <p>All systems online</p>
 * </RetroCard>
 */

export function RetroCard({
  title,
  status,
  children,
  collapsible = false,
  defaultExpanded = true,
  variant = 'default',
  footer,
  onHeaderClick,
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleHeaderClick = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
    if (onHeaderClick) {
      onHeaderClick();
    }
  };

  // Variant styles
  const variantClasses = {
    default: {
      header: 'bg-black text-white',
      body: 'bg-white',
      border: 'border-black',
    },
    terminal: {
      header: 'bg-black text-green-500',
      body: 'bg-black text-green-500',
      border: 'border-green-500',
    },
    danger: {
      header: 'bg-red-600 text-white',
      body: 'bg-white',
      border: 'border-red-600',
    },
    warning: {
      header: 'bg-yellow-500 text-black',
      body: 'bg-white',
      border: 'border-yellow-500',
    },
  };

  const styles = variantClasses[variant] || variantClasses.default;

  return (
    <div className={`retro-card border-2 ${styles.border} ${className}`}>
      {/* Title Bar */}
      <div
        className={`
          ${styles.header}
          px-3 py-2
          font-pixel text-sm
          uppercase
          flex items-center justify-between
          border-b-2 ${styles.border}
          ${collapsible ? 'cursor-pointer' : ''}
        `}
        onClick={handleHeaderClick}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeaderClick();
          }
        } : undefined}
      >
        <span className="flex items-center space-x-2">
          <span>▓▓▓ {title}</span>
          {status && (
            <span className="text-xs font-mono">
              [{status}]
            </span>
          )}
        </span>
        {collapsible && (
          <span className="text-xs">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        )}
      </div>

      {/* Body */}
      {isExpanded && (
        <div className={`${styles.body} p-4`}>
          {children}
        </div>
      )}

      {/* Footer with ASCII decoration */}
      {footer && isExpanded && (
        <div className={`
          bg-gray-100
          px-3 py-2
          text-xs
          font-mono
          border-t-2 ${styles.border}
          flex items-center justify-between
        `}>
          <span className="text-gray-600">└{'─'.repeat(50)}┘</span>
          <span>{footer}</span>
        </div>
      )}
    </div>
  );
}

/**
 * RetroCardGrid - Grid layout for multiple cards
 */
export function RetroCardGrid({ children, cols = 2, className = '' }) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridClasses[cols]} gap-4 ${className}`}>
      {children}
    </div>
  );
}

