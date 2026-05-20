/**
 * PageShell — Standard page wrapper for all dashboard pages.
 *
 * Provides:
 * - Consistent horizontal + vertical padding
 * - Page title + subtitle slot
 * - Optional right-side action area
 * - Dark mode support
 */
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove default padding — for full-bleed pages */
  noPadding?: boolean;
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
  noPadding = false,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col min-h-full', !noPadding && 'px-6 py-6', className)}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Page Content */}
      <div className="flex-1 space-y-5">{children}</div>
    </div>
  );
}
