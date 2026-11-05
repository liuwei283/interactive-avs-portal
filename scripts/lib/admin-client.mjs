// Shared helper for maintenance scripts: signs in as the portal administrator
// with the PUBLIC anon key + the admin password, so every write goes through
// the same Row Level Security as the website. No service-role key is used.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

export function loadEnv(root = process.cwd()) {
  const env = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return env;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

export async function adminClient() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const email = env.VITE_ADMIN_EMAIL;
  if (!url || !key || !email) {
    throw new Error('Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_ADMIN_EMAIL (e.g. in .env.local).');
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Note: SUPABASE_SERVICE_ROLE_KEY is set but is intentionally NOT used by this script.');
  }
  const password = env.PORTAL_ADMIN_PASSWORD || (await promptHidden(`Password for admin (${email}): `));
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  const { data: ok, error: e2 } = await supabase.rpc('is_admin');
  if (e2) throw new Error(`is_admin() failed: ${e2.message}. Have the migrations been applied?`);
  if (!ok) throw new Error('Signed in, but this user is not in public.app_admins. See README → Initial administrator provisioning.');
  return supabase;
}

export function check(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
