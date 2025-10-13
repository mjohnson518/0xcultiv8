/**
 * RetroButton Component
 * Pixel-perfect button with terminal aesthetic
 * Auto-adds brackets, inverts on hover, press effect on active
 */

export function RetroButton({
  children,
  onClick,
  variant = 'default',
  size = 'medium',
  disabled = false,
  className = '',
  type = 'button',
  href,
  ...props
}) {
  // Ensure text has brackets
  const text = typeof children === 'string' && !children.startsWith('[')
    ? `[${children.toUpperCase()}]`
    : children;

  // Size classes
  const sizeClasses = {
    small: 'h-9 px-3 text-sm', // 36px height
    medium: 'h-11 px-6 text-base', // 44px height
    large: 'h-13 px-8 text-lg', // 52px height
  };

  // Variant classes - using CSS variables for dark mode
  const variantClasses = {
    default: 'bg-retro-bg text-retro-fg hover:bg-retro-black hover:text-retro-white border-retro-black',
    primary: 'bg-retro-black text-retro-white hover:bg-retro-gray-800 border-retro-black',
    danger: 'bg-retro-bg text-retro-red hover:bg-retro-red hover:text-retro-white border-retro-red',
    success: 'bg-retro-black text-retro-green hover:bg-retro-green hover:text-retro-black border-retro-green',
  };

  const baseClasses = `
    retro-button
    inline-flex items-center justify-center
    border-2
    font-pixel
    uppercase
    transition-none
    cursor-pointer
    active:translate-x-0.5 active:translate-y-0.5
    disabled:bg-retro-gray-300 disabled:text-retro-gray-600 disabled:cursor-not-allowed disabled:transform-none
    focus-visible:outline focus-visible:outline-3 focus-visible:outline-retro-black focus-visible:outline-offset-2
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Render as link if href provided
  if (href) {
    return (
      <a
        href={href}
        className={baseClasses}
        {...props}
      >
        {text}
      </a>
    );
  }

  // Render as button
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
      {...props}
    >
      {text}
    </button>
  );
}

/**
 * Retro Icon Button - For icons without text
 */
export function RetroIconButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  className = '',
  ...props
}) {
  const variantClasses = {
    default: 'bg-white text-black hover:bg-black hover:text-white',
    primary: 'bg-black text-white hover:bg-gray-800',
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-11 h-11
        border-2 border-black
        inline-flex items-center justify-center
        cursor-pointer
        transition-none
        active:translate-x-0.5 active:translate-y-0.5
        focus-visible:outline focus-visible:outline-3 focus-visible:outline-black
        ${variantClasses[variant]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      aria-label={label}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5" />}
    </button>
  );
}

