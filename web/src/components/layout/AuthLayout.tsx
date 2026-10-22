/**
 * STELLAR — Auth Layout
 *
 * Split-panel layout used for Login and Register pages.
 * Left: blue gradient brand panel (40%), Right: white form card (60%).
 */


import { GraduationCap, Star } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): React.ReactElement {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-2/5 auth-gradient flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-10 h-48 w-48 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <GraduationCap className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">STELLAR</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Discover Student
              <br />
              <span className="text-sky-300">Excellence</span>
            </h1>
            <p className="mt-4 text-blue-100 text-base leading-relaxed max-w-xs">
              STELLAR connects student talent with opportunities — showcasing skills,
              achievements and potential across your institution.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-3">
            {[
              'Centralised talent profiles',
              'Real-time attendance & results',
              'Faculty-student collaboration',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2.5">
                <Star className="h-4 w-4 text-sky-300 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm text-blue-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-blue-200">
          © {new Date().getFullYear()} STELLAR — Student Talent, Excellence &amp; Leadership
        </p>
      </div>

      {/* ── Right: form panel ─────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-[--surface] p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo (shown only on small screens) */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--primary]">
                <GraduationCap className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold text-[--text]">STELLAR</span>
            </div>
          </div>

          {/* Card */}
          <div className="card">
            <div className="mb-6">
              <h2 className="page-title">{title}</h2>
              {subtitle && (
                <p className="mt-1 text-sm text-[--text-muted]">{subtitle}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
