// Fails the build if the public bundle (dist/) contains anything that must
// never be published: privileged keys, private files, or seed content.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const dist = join(process.cwd(), 'dist');
const problems = [];

const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.svg', '.txt', '.woff', '.woff2', '.ttf', '.ico', '.map', '']);
const FORBIDDEN_EXT = new Set(['.pdf', '.pptx', '.mp4', '.webm', '.wav', '.mp3', '.flac', '.json', '.csv', '.sql', '.env']);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else check(p);
  }
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function check(file) {
  const rel = relative(dist, file);
  const ext = extname(file).toLowerCase();
  if (FORBIDDEN_EXT.has(ext)) problems.push(`${rel}: file type ${ext} must not be in the public build (research files belong in Supabase Storage)`);
  else if (!ALLOWED_EXT.has(ext)) problems.push(`${rel}: unexpected file type ${ext}`);
  if (/^private\//.test(rel) || /seed/i.test(rel)) problems.push(`${rel}: private/seed content in build`);
  if (!['.js', '.html', '.css', '.txt', '.svg', '.map'].includes(ext)) return;
  const text = readFileSync(file, 'utf8');
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) problems.push(`${rel}: contains a Supabase secret key (sb_secret_…)`);
  if (/SUPABASE_SERVICE_ROLE|service_role_key/i.test(text)) problems.push(`${rel}: references a service-role key variable`);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    const payload = decodeJwtPayload(m[0]);
    if (payload?.role && payload.role !== 'anon') problems.push(`${rel}: contains a JWT with role "${payload.role}" (only the anon key may be public)`);
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) problems.push(`${rel}: contains a private key`);
  for (const pat of (process.env.PROTECTED_PATTERNS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (text.toLowerCase().includes(pat.toLowerCase())) problems.push(`${rel}: contains protected term "${pat}" (PROTECTED_PATTERNS)`);
  }
}

walk(dist);
if (problems.length) {
  console.error('Bundle security check FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Bundle security check passed: no secrets, private files or seed content in dist/.');
