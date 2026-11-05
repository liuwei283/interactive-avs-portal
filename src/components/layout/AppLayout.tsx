import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useSiteSettings } from '../../lib/api';
import { config } from '../../lib/config';

export const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/survey', label: 'Survey' },
  { to: '/documents', label: 'Documents' },
  { to: '/progress', label: 'Weekly Progress' },
  { to: '/models', label: 'Models' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `relative px-1 py-3 text-sm font-medium transition-colors ${
    isActive
      ? 'text-accent-800 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent-700'
      : 'text-slate-600 hover:text-slate-900'
  }`;
}

export function AppLayout() {
  const { signOut } = useAuth();
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');
  const title = settings.data?.short_title || settings.data?.project_title || config.siteTitle;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 py-3" onClick={() => setOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
              {settings.data?.affiliation && (
                <span className="hidden truncate text-xs text-slate-500 sm:block">
                  {settings.data.affiliation}
                  {settings.data.collaboration ? ` · ${settings.data.collaboration}` : ''}
                </span>
              )}
            </span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <NavLink
              to="/admin"
              className={({ isActive }) => `btn-secondary btn-sm ${isActive || inAdmin ? 'border-accent-500 text-accent-800' : ''}`}
            >
              Admin
            </NavLink>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void signOut()}>
              Log out
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-slate-200 px-4 pb-3 lg:hidden">
            {[...NAV, { to: '/admin', label: 'Admin', end: false }].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `block rounded px-2 py-2 text-sm ${isActive ? 'bg-accent-50 font-medium text-accent-800' : 'text-slate-700'}`}
              >
                {n.label}
              </NavLink>
            ))}
            <button type="button" className="mt-1 block w-full rounded px-2 py-2 text-left text-sm text-slate-700" onClick={() => void signOut()}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Internal research workspace · access restricted to authorized collaborators
      </footer>
    </div>
  );
}
