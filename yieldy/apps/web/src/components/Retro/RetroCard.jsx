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

  // Variant styles - using CSS variables for dark mode support
  const variantClasses = {
    default: {
      header: 'retro-bg-black retro-text-bg', // Uses CSS variables
      body: 'bg-retro-bg text-retro-fg',
      border: 'retro-border-3', // Uses CSS variable for adaptive color
    },
    terminal: {
      header: 'bg-retro-black text-retro-green',
      body: 'bg-retro-black text-retro-green',
      border: 'border-retro-green border-3',
    },
    danger: {
      header: 'bg-retro-red text-retro-white',
      body: 'bg-retro-bg text-retro-fg',
      border: 'border-retro-red border-3',
    },
    warning: {
      header: 'bg-retro-amber text-retro-black',
      body: 'bg-retro-bg text-retro-fg',
      border: 'border-retro-amber border-3',
    },
  };

  const styles = variantClasses[variant] || variantClasses.default;

  return (
    <div className={`retro-card ${styles.border} ${className}`}>
      {/* Title Bar */}
      <div
        className={`
          ${styles.header}
          px-3 py-2
          font-pixel text-sm
          uppercase
          flex items-center justify-between
          border-b-3 retro-border
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
          bg-retro-gray-100
          px-3 py-2
          text-xs
          font-mono
          border-t-3 retro-border
          flex items-center justify-between
        `}>
          <span className="text-retro-gray-600">└{'─'.repeat(50)}┘</span>
          <span className="text-retro-fg">{footer}</span>
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

