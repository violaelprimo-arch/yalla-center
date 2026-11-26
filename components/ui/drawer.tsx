'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: 'start' | 'end' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
  ariaLabel?: string;
}

const horizontalSizes: Record<NonNullable<DrawerProps['size']>, string> = {
  sm: 'w-full max-w-xs',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
  xl: 'w-full max-w-2xl',
};

const bottomSizes: Record<NonNullable<DrawerProps['size']>, string> = {
  sm: 'max-h-[40vh]',
  md: 'max-h-[60vh]',
  lg: 'max-h-[80vh]',
  xl: 'max-h-[92vh]',
};

export function Drawer({
  isOpen,
  onClose,
  side = 'end',
  size = 'md',
  title,
  description,
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEsc = true,
  showCloseButton = true,
  className,
  ariaLabel,
}: DrawerProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sideClasses =
    side === 'start'
      ? cn(
          'inset-y-0 start-0 border-e border-border animate-yc-drawer-start',
          horizontalSizes[size]
        )
      : side === 'bottom'
        ? cn(
            'inset-x-0 bottom-0 w-full rounded-t-3xl border-t border-border pb-safe animate-yc-drawer-bottom',
            bottomSizes[size]
          )
        : cn(
            'inset-y-0 end-0 border-s border-border animate-yc-drawer-end',
            horizontalSizes[size]
          );

  return (
    <div dir="rtl" className="fixed inset-0 z-50">
      <div
        data-testid="drawer-backdrop"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="fixed inset-0 bg-brand-navy-950/70 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={!title ? ariaLabel : undefined}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        data-side={side}
        tabIndex={-1}
        className={cn(
          'fixed z-10 flex flex-col bg-card text-card-foreground shadow-soft-xl outline-none motion-reduce:animate-none',
          sideClasses,
          className
        )}
      >
        {(title || description || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
            <div className="space-y-1 text-start min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-bold text-foreground leading-snug"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق اللوحة"
                className="h-9 w-9 rounded-xl inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 shrink-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 text-start">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 dark:bg-brand-navy-900/40 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
