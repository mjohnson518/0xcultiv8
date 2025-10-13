import { useEffect } from 'react';
import { X } from 'lucide-react';
import { RetroIconButton } from './RetroButton';

/**
 * RetroModal Component
 * Pixel-bordered modal with ASCII corner decorations
 * 
 * @example
 * <RetroModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="CONFIRM ACTION"
 *   variant="confirm"
 * >
 *   <p>Are you sure?</p>
 * </RetroModal>
 */

export function RetroModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  variant = 'default',
  closeOnOutsideClick = true,
  width = 'md',
  className = '',
}) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Width classes
  const widthClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  // Variant styles
  const variantStyles = {
    default: {
      header: 'bg-black text-white',
      border: 'border-black',
    },
    confirm: {
      header: 'bg-black text-green-500',
      border: 'border-green-500',
    },
    alert: {
      header: 'bg-yellow-500 text-black',
      border: 'border-yellow-500',
    },
    danger: {
      header: 'bg-red-600 text-white',
      border: 'border-red-600',
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.8),
            rgba(0, 0, 0, 0.8) 1px,
            transparent 1px,
            transparent 2px
          )`,
        }}
        onClick={closeOnOutsideClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`
          relative
          ${widthClasses[width]}
          w-full
          bg-white
          border-3 ${styles.border}
          shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ASCII Corner Decorations */}
        <div className="absolute -top-2 -left-2 text-xl font-mono pointer-events-none">
          ┌
        </div>
        <div className="absolute -top-2 -right-2 text-xl font-mono pointer-events-none">
          ┐
        </div>
        <div className="absolute -bottom-2 -left-2 text-xl font-mono pointer-events-none">
          └
        </div>
        <div className="absolute -bottom-2 -right-2 text-xl font-mono pointer-events-none">
          ┘
        </div>

        {/* Header */}
        <div className={`
          ${styles.header}
          px-4 py-3
          border-b-2 ${styles.border}
          flex items-center justify-between
        `}>
          <h2
            id="modal-title"
            className="font-pixel text-sm uppercase"
          >
            ▓▓▓ {title}
          </h2>
          <RetroIconButton
            icon={X}
            label="Close modal"
            onClick={onClose}
            className={`
              ${styles.header} ${styles.border}
              hover:bg-red-600 hover:text-white hover:border-red-600
              w-8 h-8
            `}
          />
        </div>

        {/* Body */}
        <div className="p-6 font-mono text-base">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`
            px-6 py-4
            border-t-2 ${styles.border}
            bg-gray-50
            flex items-center justify-end space-x-3
          `}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * RetroConfirmModal - Pre-configured confirmation modal
 */
export function RetroConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'CONFIRM ACTION',
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
}) {
  const { RetroButton } = await import('./RetroButton');

  return (
    <RetroModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant="confirm"
      footer={
        <>
          <RetroButton onClick={onClose}>
            {cancelText}
          </RetroButton>
          <RetroButton onClick={onConfirm} variant="primary">
            {confirmText}
          </RetroButton>
        </>
      }
    >
      <div className="terminal-text p-4">
        <div className="terminal-line">
          {message}
        </div>
        <div className="terminal-line mt-2">
          <span className="text-yellow-500">⚠ This action cannot be undone.</span>
        </div>
      </div>
    </RetroModal>
  );
}

