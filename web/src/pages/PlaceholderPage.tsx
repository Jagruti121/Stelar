/**
 * Placeholder pages for routes not yet implemented.
 * Each returns a consistent "coming soon" card.
 */


import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

function PlaceholderPage(): React.ReactElement {
  const location = useLocation();
  const pathLabel = location.pathname.replace('/app/', '').replace(/-/g, ' ');

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="page-title capitalize">{pathLabel || 'Page'}</h1>
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <div className="kpi-icon-wrap mb-4">
          <Construction className="h-6 w-6 text-[--primary]" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-[--text]">Coming Soon</h2>
        <p className="text-sm text-[--text-muted] mt-1 max-w-xs">
          This feature will be implemented in an upcoming phase. The design system
          and routing are ready.
        </p>
        <span className="badge-primary mt-4">Under Development</span>
      </div>
    </div>
  );
}

export const ProfilePage = (): React.ReactElement => <PlaceholderPage />;
export const AttendancePage = (): React.ReactElement => <PlaceholderPage />;
export const ResultsPage = (): React.ReactElement => <PlaceholderPage />;
export const NotificationsPage = (): React.ReactElement => <PlaceholderPage />;
export const PollsPage = (): React.ReactElement => <PlaceholderPage />;
export const CommunitiesPage = (): React.ReactElement => <PlaceholderPage />;
export const TalentPage = (): React.ReactElement => <PlaceholderPage />;
export const ResourcesPage = (): React.ReactElement => <PlaceholderPage />;
export const OpportunitiesPage = (): React.ReactElement => <PlaceholderPage />;
export const StudentsPage = (): React.ReactElement => <PlaceholderPage />;
export const ResultsUploadPage = (): React.ReactElement => <PlaceholderPage />;
