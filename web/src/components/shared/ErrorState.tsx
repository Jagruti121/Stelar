/**
 * ErrorState — inline error display with retry capability.
 * Shown when a query fails or a critical error occurs.
 */


import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
}: ErrorStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
      role="alert"
    >
      {/* Error icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-4">
        <AlertCircle className="h-8 w-8 text-[--danger]" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-[--text] mb-1">{title}</h3>

      <p className="text-sm text-[--text-muted] max-w-sm mb-4">{message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary flex items-center gap-2"
          aria-label="Retry"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

/** Full-page error boundary fallback. */
export function ErrorPage({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-[--surface] flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <ErrorState
          title="Application Error"
          message={error.message || 'An unexpected error occurred.'}
          onRetry={resetErrorBoundary}
        />
      </div>
    </div>
  );
}
