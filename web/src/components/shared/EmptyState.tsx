/**
 * EmptyState — centered icon + message + optional CTA.
 * Every page/list that can be empty must render this.
 */


import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Icon circle */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[--primary-soft] mb-4">
        <Icon className="h-8 w-8 text-[--primary]" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-[--text] mb-1">{title}</h3>

      {description && (
        <p className="text-sm text-[--text-muted] max-w-sm mb-4">{description}</p>
      )}

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
