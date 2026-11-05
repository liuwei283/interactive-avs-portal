import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Spinner } from '../ui';

/**
 * Client-side route guard for UX only. The real protection is server-side:
 * without an admin JWT, Supabase RLS returns no rows and storage refuses files.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking session…" />
      </div>
    );
  }
  if (!session || !isAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }
  return <>{children}</>;
}
