/**
 * STELLAR — Unauthorized Page (403)
 */


import { Link, useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[--surface] flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mx-auto mb-4"
        >
          <ShieldOff className="h-8 w-8 text-[--danger]" aria-hidden="true" />
        </div>
        <h1 className="page-title">Access Denied</h1>
        <p className="text-sm text-[--text-muted] mt-2 mb-6">
          You don&apos;t have permission to view this page.
          Contact your administrator if you believe this is an error.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
          <Link to="/app/dashboard" className="btn-primary">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
