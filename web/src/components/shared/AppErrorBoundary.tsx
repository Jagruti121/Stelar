import { useRouteError, useNavigate } from 'react-router-dom';
import { RotateCcw, Home, AlertTriangle } from 'lucide-react';

export function AppErrorBoundary(): React.ReactElement {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred.');
  const isFirestoreAssertion = errorMessage.includes('INTERNAL ASSERTION FAILED') || errorMessage.includes('FIRESTORE');

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/app/dashboard', { replace: true });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="card max-w-lg w-full text-center p-8 shadow-xl border-red-100 space-y-6">
        <div className="mx-auto w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isFirestoreAssertion ? 'Sync Stream Reset' : 'Something went wrong'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {isFirestoreAssertion
              ? 'A temporary stream disconnect occurred while switching views. A quick refresh will restore your active session.'
              : errorMessage}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={handleRefresh}
            className="btn-primary flex items-center justify-center gap-2 py-2.5 px-5 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh & Resume
          </button>
          <button
            onClick={handleGoHome}
            className="btn-secondary flex items-center justify-center gap-2 py-2.5 px-5 text-sm"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppErrorBoundary;
