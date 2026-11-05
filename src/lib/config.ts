// All values here are public (bundled into the browser build).
// Secrets must never be read from import.meta.env.

const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, ''),
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  adminEmail: (env.VITE_ADMIN_EMAIL ?? '').trim(),
  siteTitle: (env.VITE_SITE_TITLE ?? '').trim() || 'Research Portal',
  maxUploadMb: Number(env.VITE_MAX_UPLOAD_MB) > 0 ? Number(env.VITE_MAX_UPLOAD_MB) : 50,
  bucket: 'research-files',
  signedUrlSeconds: 60 * 60,
  /** Files at or above this size use resumable (TUS) uploads. */
  resumableThresholdBytes: 6 * 1024 * 1024,
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey && config.adminEmail);

export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!config.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!config.adminEmail) missing.push('VITE_ADMIN_EMAIL');
  return missing;
}
