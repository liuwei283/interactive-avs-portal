#!/usr/bin/env node
// Publish a weekly report folder to the portal.
//
//   npm run sync:week -- <folder> [--dry-run] [--publish]
//
// <folder> contains week.md (YAML front matter + free-form Markdown) and any
// media it references by relative path. The script:
//   1. validates every referenced file (exists, allowed type, ≤ 50 MB),
//   2. uploads new files to the private bucket (identical files are reused by
//      SHA-256, so re-syncing is cheap),
//   3. rewrites paths to asset:<uuid>, inlines ```metrics csv: files,
//   4. optionally upserts <folder>/experiments.json (same format as `npm run upsert`),
//   5. creates/updates the weekly page (new weeks are drafts unless --publish
//      or `status: published` in the front matter).
// Signs in as the admin (anon key + password), so RLS applies.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { adminClient, check, loadEnv } from './lib/admin-client.mjs';
import { applyUpserts, idBy } from './lib/upsert-lib.mjs';
import { FILE_TYPES, collectRefs, isMonday, mondayOf, parseWeekFile, transformRefs } from './lib/week-report.mjs';

const args = process.argv.slice(2);
const folderArg = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const forcePublish = args.includes('--publish');
if (!folderArg) {
  console.error('Usage: npm run sync:week -- <folder> [--dry-run] [--publish]');
  process.exit(2);
}
const folder = resolve(folderArg);
const weekFile = join(folder, 'week.md');
if (!existsSync(weekFile)) {
  console.error(`No week.md in ${folder}`);
  process.exit(2);
}
const MAX = 50 * 1024 * 1024;

const { meta, body } = parseWeekFile(readFileSync(weekFile, 'utf8'));
let weekStart = String(meta.week_start ?? basename(folder));
if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
  console.error(`week_start missing: set it in the front matter or name the folder YYYY-MM-DD (got "${weekStart}").`);
  process.exit(2);
}
if (!isMonday(weekStart)) {
  const m = mondayOf(weekStart);
  console.log(`week_start ${weekStart} is not a Monday → using ${m}`);
  weekStart = m;
}

// ---- validate referenced files
const resolvePath = (ref) => (isAbsolute(ref) ? ref : join(folder, decodeURIComponent(ref)));
const refs = collectRefs(body);
const problems = [];
const files = new Map(); // abs path -> { ref, kind }
for (const { ref, kind } of refs) {
  const abs = resolvePath(ref);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    problems.push(`missing file: ${ref}`);
    continue;
  }
  if (kind === 'csv') continue; // inlined, not uploaded
  const t = FILE_TYPES[extname(abs).toLowerCase()];
  if (!t) problems.push(`unsupported type: ${ref} (allowed: ${Object.keys(FILE_TYPES).join(' ')})`);
  else if (statSync(abs).size > MAX) problems.push(`too large (> 50 MB): ${ref} — compress or trim it`);
  else files.set(abs, { ref, kind, type: t });
}
const totalMb = [...files.keys()].reduce((s, f) => s + statSync(f).size, 0) / 1e6;
console.log(`Week ${weekStart}: ${refs.length} reference(s), ${files.size} file(s) to sync (${totalMb.toFixed(1)} MB)`);
if (problems.length) {
  console.error('Problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
const expFile = join(folder, 'experiments.json');
const expData = existsSync(expFile) ? JSON.parse(readFileSync(expFile, 'utf8')) : null;
if (expData) console.log(`experiments.json: ${(expData.experiments ?? []).length} experiment record(s)`);
if (dryRun) {
  for (const [abs, f] of files) console.log(`  ${f.kind.padEnd(5)} ${f.ref}  (${(statSync(abs).size / 1e6).toFixed(2)} MB)`);
  console.log('Dry run OK — nothing uploaded.');
  process.exit(0);
}

// ---- upload / reuse
const db = await adminClient();
const ids = new Map(); // abs -> asset id
let uploaded = 0;
let reused = 0;
for (const [abs, f] of files) {
  const buf = readFileSync(abs);
  const sha = createHash('sha256').update(buf).digest('hex');
  const prev = check(await db.from('assets').select('id').eq('sha256', sha).eq('archived', false).limit(1), 'hash lookup');
  if (prev.length) {
    ids.set(abs, prev[0].id);
    reused++;
    continue;
  }
  const ext = extname(abs).toLowerCase();
  const name = basename(abs, ext).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  const now = new Date();
  const key = `weekly/${weekStart}/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}/${randomBytes(6).toString('hex')}-${name}${ext}`;
  check(await db.storage.from('research-files').upload(key, buf, { contentType: f.type[1], upsert: false }), `upload ${f.ref}`);
  const row = check(
    await db.from('assets').insert({
      storage_path: key, filename: basename(abs), mime_type: f.type[1], size_bytes: buf.length, kind: f.type[0],
      title: basename(abs, ext), category: `week-${weekStart}`, tags: ['weekly-report', weekStart], sha256: sha,
    }).select('id').single(),
    `asset row ${f.ref}`,
  );
  ids.set(abs, row.id);
  uploaded++;
  console.log(`  uploaded ${f.ref}`);
}

// ---- rewrite body
const report = transformRefs(body, (ref, kind) => {
  const abs = resolvePath(ref);
  if (kind === 'csv') return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').trim();
  return `asset:${ids.get(abs)}`;
});

// ---- experiments.json (optional), then the week itself
if (expData) await applyUpserts(db, { experiments: expData.experiments ?? [] }, (m) => console.log(`  ${m}`));

const existing = check(await db.from('weekly_updates').select('id, status').eq('week_start', weekStart).maybeSingle(), 'week lookup');
const row = { week_start: weekStart, report_md: report, report_source: folder };
const copy = { title: 'title', research_focus: 'research_focus', meeting_date: 'meeting_date', summary: 'summary_md' };
for (const [k, col] of Object.entries(copy)) if (meta[k] !== undefined) row[col] = meta[k] ?? (col === 'meeting_date' ? null : '');
if (forcePublish || meta.status === 'published') row.status = 'published';
else if (meta.status === 'draft') row.status = 'draft';
else if (!existing) row.status = 'draft';

const weekRes = existing
  ? await db.from('weekly_updates').update(row).eq('id', existing.id).select('id, status').single()
  : await db.from('weekly_updates').insert(row).select('id, status').single();
const week = check(weekRes, 'save week');

if (Array.isArray(meta.components)) {
  check(await db.from('weekly_update_components').delete().eq('weekly_update_id', week.id), 'clear components');
  for (const slug of meta.components) {
    check(await db.from('weekly_update_components').insert({ weekly_update_id: week.id, model_component_id: await idBy(db, 'model_components', 'slug', slug) }), `component ${slug}`);
  }
}
const expCodes = [...(meta.experiments ?? []), ...((expData?.experiments ?? []).map((e) => e.code))];
for (const code of new Set(expCodes)) {
  const eid = await idBy(db, 'experiments', 'code', code);
  check(await db.from('weekly_update_experiments').upsert({ weekly_update_id: week.id, experiment_id: eid }, { onConflict: 'weekly_update_id,experiment_id', ignoreDuplicates: true }), `link ${code}`);
}

const site = (loadEnv().SITE_URL || '').replace(/\/$/, '');
console.log(`\n${existing ? 'Updated' : 'Created'} week ${weekStart} [${week.status}] — ${uploaded} uploaded, ${reused} reused.`);
console.log(`View: ${site || '<site>'}/progress/${weekStart}`);
if (week.status === 'draft') console.log('It is a draft: review it on the site, then publish (Admin → Weekly updates, or re-run with --publish).');
process.exit(0);

