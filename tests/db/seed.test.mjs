// Validates private/seed/content.mjs against the real schema (constraints,
// foreign keys, slugs) by inserting it as the admin role in a transaction.
// Skipped when the private seed file is absent (e.g. in CI).
import pg from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = resolve('private/seed/content.mjs');
if (!existsSync(file)) {
  console.log('SKIP seed validation (private/seed/content.mjs not present)');
  process.exit(0);
}
const seed = await import(pathToFileURL(file).href);
const ADMIN = '33333333-3333-4333-8333-333333333333';
const c = new pg.Client();
await c.connect();
await c.query(`insert into auth.users (id, email) values ($1, 'seed@example.org') on conflict do nothing`, [ADMIN]);
await c.query(`insert into public.app_admins (user_id) values ($1) on conflict do nothing`, [ADMIN]);

const ins = async (table, row) => {
  const keys = Object.keys(row);
  const r = await c.query(`insert into public.${table} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning id`, keys.map((k) => row[k]));
  return r.rows[0]?.id;
};

let failed = false;
try {
  await c.query('begin');
  await c.query('set local role authenticated');
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ADMIN })]);
  await c.query(`update public.site_settings set ${Object.keys(seed.siteSettings).map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = 1`, Object.values(seed.siteSettings));
  for (const cat of seed.surveyCategories) await c.query('insert into public.survey_categories (slug, title, description, sort_order) values ($1,$2,$3,$4)', [cat.slug, cat.title, cat.description, cat.sort_order]);
  const thrustIds = {};
  for (const t of seed.thrusts) thrustIds[t.slug] = await ins('research_thrusts', t);
  for (const [i, comp] of seed.components.entries()) {
    if (!thrustIds[comp.thrust]) throw new Error(`component ${comp.slug}: unknown thrust ${comp.thrust}`);
    await ins('model_components', { slug: comp.slug, title: comp.title, summary: comp.summary, overview_md: comp.overview, motivation_md: comp.motivation ?? '', limitations_md: comp.limitations ?? '', thrust_id: thrustIds[comp.thrust], sort_order: (i + 1) * 10, status: 'planned' });
  }
  for (const p of seed.papers) {
    const { categories, ...row } = p;
    const id = await ins('papers', row);
    for (const cat of categories ?? []) await c.query('insert into public.paper_category_links values ($1,$2)', [id, cat]);
  }
  for (const m of seed.milestones) await ins('milestones', m);
  const counts = await c.query(`select (select count(*) from public.model_components) comps, (select count(*) from public.papers) papers, (select count(*) from public.paper_category_links) links, (select count(*) from public.weekly_updates) weeks, (select count(*) from public.experiments) exps`);
  console.log('PASS  seed content satisfies schema:', counts.rows[0]);
  if (Number(counts.rows[0].weeks) !== 0 || Number(counts.rows[0].exps) !== 0) throw new Error('seed must not create weekly updates or experiments');
} catch (e) {
  failed = true;
  console.log('FAIL  seed validation:', e.message);
} finally {
  await c.query('rollback');
  await c.end();
}
process.exit(failed ? 1 : 0);
