import { useState, useEffect } from 'react';

/**
 * RetroLoader Component
 * ASCII spinner animations with multiple styles
 */

const SPINNER_FRAMES = {
  braille: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  blocks: ['▖', '▘', '▝', '▗'],
  dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  line: ['|', '/', '─', '\\'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
};

export function RetroLoader({
  type = 'braille',
  size = 'medium',
  message = '',
  variant = 'default',
  inline = false,
  progress = null,
  className = '',
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (progress !== null) return; // Don't animate if showing progress bar

    const frames = SPINNER_FRAMES[type] || SPINNER_FRAMES.braille;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 100); // 100ms per frame

    return () => clearInterval(interval);
  }, [type, progress]);

  // Size classes
  const sizeClasses = {
    small: 'text-2xl', // 24px
    medium: 'text-4xl', // 32px
    large: 'text-6xl', // 48px
  };

  // Variant classes
  const variantClasses = {
    default: 'text-black',
    terminal: 'bg-black text-green-500 p-4',
  };

  // Progress bar renderer
  if (progress !== null) {
    const percent = Math.min(100, Math.max(0, progress));
    const filled = Math.floor(percent / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    return (
      <div
        className={`font-mono ${inline ? 'inline-flex items-center space-x-2' : 'text-center'} ${className}`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={message || 'Loading progress'}
      >
        <div className={`${sizeClasses[size]} ${variantClasses[variant]}`}>
          [{bar}] {percent}%
        </div>
        {message && (
          <div className="text-sm mt-2 font-mono uppercase">
            {message}
          </div>
        )}
      </div>
    );
  }

  // Spinner renderer
  const frames = SPINNER_FRAMES[type] || SPINNER_FRAMES.braille;
  const currentFrame = frames[frame];

  return (
    <div
      className={`${inline ? 'inline-flex items-center space-x-2' : 'flex flex-col items-center justify-center'} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className={`font-mono ${sizeClasses[size]} ${variantClasses[variant]}`}>
        {currentFrame}
      </div>
      {message && (
        <div className={`font-mono text-sm mt-2 uppercase ${variant === 'terminal' ? 'text-green-500' : 'text-black'}`}>
          {message}
          <span className="blink">█</span>
        </div>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * RetroLoadingText - Text with animated dots
 */
export function RetroLoadingText({ children = 'LOADING', className = '' }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`font-mono uppercase ${className}`} role="status" aria-live="polite">
      {children}{dots}
      <span className="sr-only">Loading</span>
    </span>
  );
}

/**
 * RetroThrobber - Pulsing block animation
 */
export function RetroThrobber({ size = 'medium', className = '' }) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        border-2 border-black
        transition-colors duration-500
        ${active ? 'bg-black' : 'bg-white'}
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

