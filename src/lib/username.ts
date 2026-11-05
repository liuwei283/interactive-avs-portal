export const ADMIN_USERNAME = 'admin';

/**
 * Map the fixed portal username to the Supabase Auth email identity.
 * Returns null for any other username (there is no public registration).
 */
export function usernameToEmail(username: string, adminEmail: string): string | null {
  if (!adminEmail) return null;
  return username.trim().toLowerCase() === ADMIN_USERNAME ? adminEmail : null;
}

export function describeAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (/invalid login credentials/i.test(message)) return 'Incorrect username or password.';
  if (/email not confirmed/i.test(message)) return 'The administrator account has not been confirmed in Supabase Auth.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/fetch|network|failed to fetch/i.test(message)) return 'Cannot reach the authentication server. Check your connection and the Supabase URL.';
  return message || 'Sign-in failed.';
}
