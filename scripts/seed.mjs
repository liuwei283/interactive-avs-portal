#!/usr/bin/env node
// Load initial structured content (overview, thrusts, model components,
// survey categories, papers, milestones) from a PRIVATE seed module.
//
//   npm run seed                         # insert only what is missing (safe to re-run)
//   npm run seed -- --overwrite          # also overwrite seeded text fields (never statuses)
//   npm run seed -- --file path/to/content.mjs --dry-run
//
// The default seed file lives in private/ (git-ignored) so unpublished
// research content never enters the public repository or build.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adminClient, check } from './lib/admin-client.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : 'private/seed/content.mjs';
const overwrite = flag('--overwrite');
const dryRun = flag('--dry-run');

const seed = await import(pathToFileURL(resolve(fileArg)).href);
console.log(`Seed file: ${fileArg}`);
console.log(`  ${seed.thrusts.length} thrusts, ${seed.components.length} components, ${seed.surveyCategories.length} categories, ${seed.papers.length} papers, ${seed.milestones.length} milestones`);
if (dryRun) process.exit(0);

const db = await adminClient();
const upsertOpts = { onConflict: 'slug', ignoreDuplicates: !overwrite };

// Site settings: fill empty fields (or overwrite with --overwrite).
const current = check(await db.from('site_settings').select('*').eq('id', 1).maybeSingle(), 'read site_settings') ?? {};
const patch = Object.fromEntries(Object.entries(seed.siteSettings).filter(([k]) => overwrite || !String(current[k] ?? '').trim() || (k === 'project_title' && current[k] === 'Research Project')));
if (Object.keys(patch).length) check(await db.from('site_settings').upsert({ id: 1, ...patch }), 'site_settings');
console.log(`site_settings: ${Object.keys(patch).length} field(s) written`);

check(await db.from('survey_categories').upsert(seed.surveyCategories, upsertOpts), 'survey_categories');
check(await db.from('research_thrusts').upsert(seed.thrusts, upsertOpts), 'research_thrusts');
const thrustIds = Object.fromEntries(check(await db.from('research_thrusts').select('id, slug'), 'thrust ids').map((t) => [t.slug, t.id]));

const componentRows = seed.components.map((c, i) => {
  const row = { slug: c.slug, title: c.title, summary: c.summary, overview_md: c.overview, motivation_md: c.motivation ?? '', limitations_md: c.limitations ?? '', thrust_id: thrustIds[c.thrust] ?? null, sort_order: (i + 1) * 10 };
  if (!overwrite) row.status = 'planned';
  return row;
});
check(await db.from('model_components').upsert(componentRows, upsertOpts), 'model_components');

const paperRows = seed.papers.map(({ categories, ...p }) => {
  const row = { ...p };
  if (overwrite) delete row.reading_status; // never reset your reading progress
  return row;
});
check(await db.from('papers').upsert(paperRows, upsertOpts), 'papers');
const paperIds = Object.fromEntries(check(await db.from('papers').select('id, slug'), 'paper ids').map((p) => [p.slug, p.id]));
const links = seed.papers.flatMap((p) => (p.categories ?? []).map((c) => ({ paper_id: paperIds[p.slug], category_slug: c }))).filter((l) => l.paper_id);
check(await db.from('paper_category_links').upsert(links, { onConflict: 'paper_id,category_slug', ignoreDuplicates: true }), 'paper_category_links');

const milestoneRows = seed.milestones.map((m) => {
  const row = { ...m };
  if (overwrite) delete row.status;
  return row;
});
check(await db.from('milestones').upsert(milestoneRows, upsertOpts), 'milestones');

console.log(`Done (${overwrite ? 'overwrite' : 'insert-missing'} mode). Weekly updates and experiments are intentionally not seeded.`);
process.exit(0);
