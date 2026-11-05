import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { config, isConfigured } from './config';
import { describeAuthError, usernameToEmail } from './username';

interface AuthState {
  session: Session | null;
  /** True once the server confirmed this user is listed in app_admins. */
  isAdmin: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function checkAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw new Error(error.message);
  return data === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;

    const apply = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      if (!s) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const ok = await checkAdmin();
        if (!active) return;
        setIsAdmin(ok);
        if (!ok) await supabase.auth.signOut();
      } catch {
        if (active) setIsAdmin(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        qc.clear();
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(s);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!username.trim() || !password) throw new Error('Enter your username and password.');
    const email = usernameToEmail(username, config.adminEmail);
    if (!email) throw new Error('Incorrect username or password.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(describeAuthError(error));
    let ok = false;
    try {
      ok = await checkAdmin();
    } catch (err) {
      await supabase.auth.signOut();
      throw new Error(`Signed in, but the authorization check failed: ${describeAuthError(err)}. Have the database migrations been applied?`);
    }
    if (!ok) {
      await supabase.auth.signOut();
      throw new Error('This account is not authorized for the portal. Register it in public.app_admins (see README).');
    }
    setSession(data.session);
    setIsAdmin(true);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    qc.clear();
    setSession(null);
    setIsAdmin(false);
  }, [qc]);

  const value = useMemo(() => ({ session, isAdmin, loading, signIn, signOut }), [session, isAdmin, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
