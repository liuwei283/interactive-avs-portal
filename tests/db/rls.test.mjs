// Database authorization + integrity tests.
// Run through tests/db/run-db-tests.sh (which provides a fresh Postgres).
import pg from 'pg';
import assert from 'node:assert/strict';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const client = new pg.Client();
await client.connect();

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, name, err]);
  }
}

/** Run `fn` inside a rolled-back transaction as an API role with JWT claims. */
async function as(role, sub, fn) {
  await client.query('begin');
  try {
    await client.query(`set local role ${role}`);
    const claims = sub ? JSON.stringify({ sub, role }) : JSON.stringify({ role });
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    return await fn();
  } finally {
    await client.query('rollback');
  }
}

async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (err) {
    if (pattern) assert.match(String(err.message), pattern);
    return;
  }
  assert.fail('expected an error but the statement succeeded');
}

// ---- fixtures (as superuser) ----
await client.query(`insert into auth.users (id, email) values ($1, 'admin@example.org'), ($2, 'other@example.org')`, [ADMIN, OTHER]);
await client.query(`insert into public.app_admins (user_id) values ($1)`, [ADMIN]);
await client.query(`insert into public.research_thrusts (slug, numeral, title) values ('thrust-1', 'I', 'Thrust one')`);
await client.query(`insert into public.weekly_updates (week_start, status) values ('2026-11-02', 'published')`);

const TABLES = [
  'site_settings', 'research_thrusts', 'assets', 'asset_versions', 'model_components',
  'experiments', 'experiment_metrics', 'weekly_updates', 'weekly_update_experiments',
  'weekly_update_components', 'documents', 'document_versions', 'survey_categories',
  'papers', 'paper_category_links', 'milestones', 'content_asset_links', 'app_admins',
];

// ---------------- anonymous ----------------
for (const t of TABLES) {
  await test(`anon cannot read ${t}`, () =>
    as('anon', null, () => expectError(client.query(`select * from public.${t}`), /permission denied/)));
}
await test('anon cannot insert weekly update', () =>
  as('anon', null, () => expectError(client.query(`insert into public.weekly_updates (week_start) values ('2026-11-09')`), /permission denied/)));
await test('anon cannot call asset_references', () =>
  as('anon', null, () => expectError(client.query(`select * from public.asset_references(gen_random_uuid())`), /permission denied/)));
// Put an object in storage as superuser, then check visibility.
await client.query(`insert into storage.objects (bucket_id, name) values ('research-files', 'weekly/2026-11-02/slides.pdf')`);

await test('anon cannot read research-files objects', () =>
  as('anon', null, async () => {
    const r = await client.query(`select * from storage.objects where bucket_id = 'research-files'`);
    assert.equal(r.rowCount, 0);
  }));
await test('anon cannot upload research-files objects', () =>
  as('anon', null, () => expectError(
    client.query(`insert into storage.objects (bucket_id, name) values ('research-files', 'evil.pdf')`),
    /row-level security/)));

// ---------------- authenticated, not admin ----------------
for (const t of TABLES.filter((t) => t !== 'app_admins')) {
  await test(`non-admin sees 0 rows in ${t}`, () =>
    as('authenticated', OTHER, async () => {
      const r = await client.query(`select * from public.${t}`);
      assert.equal(r.rowCount, 0);
    }));
}
await test('non-admin is_admin() = false', () =>
  as('authenticated', OTHER, async () => {
    const r = await client.query('select public.is_admin() as a');
    assert.equal(r.rows[0].a, false);
  }));
await test('non-admin cannot insert weekly update', () =>
  as('authenticated', OTHER, () => expectError(
    client.query(`insert into public.weekly_updates (week_start) values ('2026-11-09')`), /row-level security/)));
await test('non-admin cannot update weekly update', () =>
  as('authenticated', OTHER, async () => {
    const r = await client.query(`update public.weekly_updates set title = 'hacked'`);
    assert.equal(r.rowCount, 0);
  }));
await test('non-admin cannot delete weekly update', () =>
  as('authenticated', OTHER, async () => {
    const r = await client.query(`delete from public.weekly_updates`);
    assert.equal(r.rowCount, 0);
  }));
await test('non-admin cannot self-register as admin', () =>
  as('authenticated', OTHER, () => expectError(
    client.query(`insert into public.app_admins (user_id) values ($1)`, [OTHER]), /permission denied/)));
await test('non-admin cannot read storage objects', () =>
  as('authenticated', OTHER, async () => {
    const r = await client.query(`select * from storage.objects`);
    assert.equal(r.rowCount, 0);
  }));
await test('non-admin cannot upload storage objects', () =>
  as('authenticated', OTHER, () => expectError(
    client.query(`insert into storage.objects (bucket_id, name) values ('research-files', 'x.pdf')`), /row-level security/)));
await test('authenticated without sub claim sees nothing', () =>
  as('authenticated', null, async () => {
    const r = await client.query(`select * from public.weekly_updates`);
    assert.equal(r.rowCount, 0);
  }));

// ---------------- admin ----------------
await test('admin is_admin() = true', () =>
  as('authenticated', ADMIN, async () => {
    const r = await client.query('select public.is_admin() as a');
    assert.equal(r.rows[0].a, true);
  }));
await test('admin can read seeded rows', () =>
  as('authenticated', ADMIN, async () => {
    assert.equal((await client.query('select * from public.weekly_updates')).rowCount, 1);
    assert.equal((await client.query('select * from public.site_settings')).rowCount, 1);
  }));
await test('admin can read only own app_admins row', () =>
  as('authenticated', ADMIN, async () => {
    const r = await client.query('select * from public.app_admins');
    assert.equal(r.rowCount, 1);
  }));
await test('admin cannot add another admin through the API', () =>
  as('authenticated', ADMIN, () => expectError(
    client.query(`insert into public.app_admins (user_id) values ($1)`, [OTHER]), /permission denied/)));
await test('admin full weekly/experiment workflow', () =>
  as('authenticated', ADMIN, async () => {
    const w = await client.query(`insert into public.weekly_updates (week_start, status, summary_md) values ('2026-11-09', 'draft', 'x') returning id, published_at`);
    assert.equal(w.rows[0].published_at, null);
    const c = await client.query(`insert into public.model_components (slug, title, thrust_id) select 'v2a-baseline', 'V2A', id from public.research_thrusts where slug='thrust-1' returning id`);
    const e = await client.query(`insert into public.experiments (code, name, model_component_id) values ('EXP-0001', 'test', $1) returning id`, [c.rows[0].id]);
    await client.query(`insert into public.weekly_update_experiments (weekly_update_id, experiment_id) values ($1, $2)`, [w.rows[0].id, e.rows[0].id]);
    await client.query(`insert into public.experiment_metrics (experiment_id, metric_name, value) values ($1, 'm', null)`, [e.rows[0].id]);
    const p = await client.query(`update public.weekly_updates set status = 'published' where id = $1 returning published_at`, [w.rows[0].id]);
    assert.ok(p.rows[0].published_at);
    const back = await client.query(`select w.week_start from public.weekly_update_experiments l join public.weekly_updates w on w.id = l.weekly_update_id where l.experiment_id = $1`, [e.rows[0].id]);
    assert.equal(back.rowCount, 1);
  }));
await test('admin can read and write research-files objects', () =>
  as('authenticated', ADMIN, async () => {
    assert.equal((await client.query(`select * from storage.objects where bucket_id='research-files'`)).rowCount, 1);
    await client.query(`insert into storage.objects (bucket_id, name) values ('research-files', 'assets/new.png')`);
    const d = await client.query(`delete from storage.objects where name = 'assets/new.png'`);
    assert.equal(d.rowCount, 1);
  }));
await test('admin policies do not extend to other buckets', () =>
  as('authenticated', ADMIN, async () => {
    await client.query('reset role');
    await client.query(`insert into storage.buckets (id, name, public) values ('other', 'other', false)`);
    await client.query('set local role authenticated');
    await expectError(client.query(`insert into storage.objects (bucket_id, name) values ('other', 'x')`), /row-level security/);
  }));

// ---------------- integrity ----------------
await test('bucket is private', async () => {
  const r = await client.query(`select public, file_size_limit from storage.buckets where id = 'research-files'`);
  assert.equal(r.rows[0].public, false);
  assert.equal(Number(r.rows[0].file_size_limit), 52428800);
});
await test('week_start must be a Monday', () =>
  as('authenticated', ADMIN, () => expectError(
    client.query(`insert into public.weekly_updates (week_start) values ('2026-11-04')`), /check constraint/)));
await test('week_start is unique', () =>
  as('authenticated', ADMIN, () => expectError(
    client.query(`insert into public.weekly_updates (week_start) values ('2026-11-02')`), /duplicate key/)));
await test('experiment code is validated', () =>
  as('authenticated', ADMIN, () => expectError(
    client.query(`insert into public.experiments (code, name) values ('bad code!', 'x')`), /check constraint/)));
await test('linked asset cannot be deleted; references are reported', () =>
  as('authenticated', ADMIN, async () => {
    const a = await client.query(`insert into public.assets (storage_path, filename, mime_type, size_bytes, kind) values ('a/1.wav', '1.wav', 'audio/wav', 10, 'audio') returning id`);
    const id = a.rows[0].id;
    const w = await client.query(`select id from public.weekly_updates where week_start = '2026-11-02'`);
    await client.query(`insert into public.content_asset_links (asset_id, entity_type, entity_id, role) values ($1, 'weekly_update', $2, 'audio')`, [id, w.rows[0].id]);
    const b = await client.query(`insert into public.assets (storage_path, filename, mime_type, size_bytes, kind) values ('a/2.png', '2.png', 'image/png', 10, 'image') returning id`);
    await client.query(`update public.weekly_updates set results_md = $1 where id = $2`, [`![fig](asset:${b.rows[0].id})`, w.rows[0].id]);
    const refs = await client.query(`select * from public.asset_references($1)`, [id]);
    assert.equal(refs.rowCount, 1);
    assert.equal(refs.rows[0].via, 'attachment:audio');
    const inline = await client.query(`select * from public.asset_references($1)`, [b.rows[0].id]);
    assert.equal(inline.rowCount, 1);
    assert.equal(inline.rows[0].via, 'inline markdown');
    await client.query('savepoint s');
    await expectError(client.query(`delete from public.assets where id = $1`, [id]), /foreign key/);
    await client.query('rollback to savepoint s');
    // Deleting the weekly update removes its attachment rows.
    await client.query(`delete from public.weekly_updates where id = $1`, [w.rows[0].id]);
    const left = await client.query(`select count(*)::int as n from public.content_asset_links where asset_id = $1`, [id]);
    assert.equal(left.rows[0].n, 0);
    await client.query(`delete from public.assets where id = $1`, [id]);
  }));
await test('document file asset is protected from deletion', () =>
  as('authenticated', ADMIN, async () => {
    const a = await client.query(`insert into public.assets (storage_path, filename, mime_type, size_bytes, kind) values ('d/p.pdf', 'p.pdf', 'application/pdf', 10, 'pdf') returning id`);
    await client.query(`insert into public.documents (slug, title, file_asset_id) values ('proposal', 'P', $1)`, [a.rows[0].id]);
    await expectError(client.query(`delete from public.assets where id = $1`, [a.rows[0].id]), /foreign key/);
  }));
await test('papers link to multiple categories', () =>
  as('authenticated', ADMIN, async () => {
    await client.query(`insert into public.survey_categories (slug, title) values ('v2a', 'V2A'), ('foley', 'Foley')`);
    const p = await client.query(`insert into public.papers (slug, title) values ('mmaudio', 'MMAudio') returning id`);
    await client.query(`insert into public.paper_category_links values ($1, 'v2a'), ($1, 'foley')`, [p.rows[0].id]);
    const r = await client.query(`select count(*)::int as n from public.paper_category_links where paper_id = $1`, [p.rows[0].id]);
    assert.equal(r.rows[0].n, 2);
  }));

await client.end();

let failed = 0;
for (const [ok, name, err] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${err?.message}`}`);
  if (!ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} database tests passed`);
process.exit(failed ? 1 : 0);
