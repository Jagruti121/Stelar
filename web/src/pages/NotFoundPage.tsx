/**
 * STELLAR — 404 Not Found Page
 */


import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[--surface] flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="kpi-icon-wrap mx-auto mb-4">
          <MapPin className="h-6 w-6 text-[--primary]" aria-hidden="true" />
        </div>
        <h1 className="page-title">404 — Page Not Found</h1>
        <p className="text-sm text-[--text-muted] mt-2 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/app/dashboard" className="btn-primary inline-flex">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
