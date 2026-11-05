import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isConfigured } from './config';

// The anon/publishable key is designed to be public. All data access is
// enforced server-side by Row Level Security (see supabase/migrations).
export const supabase: SupabaseClient = createClient(
  isConfigured ? config.supabaseUrl : 'http://localhost:54321',
  isConfigured ? config.supabaseAnonKey : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'research-portal-auth',
    },
  },
);
