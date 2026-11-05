// Shared by `npm run upsert` and `npm run sync:week`: upsert records by natural key.
import { check } from './admin-client.mjs';

export async function upsertBy(db, table, key, row) {
  const existing = check(await db.from(table).select('id').eq(key, row[key]).maybeSingle(), `${table} lookup`);
  const res = existing
    ? await db.from(table).update(row).eq('id', existing.id).select('id').single()
    : await db.from(table).insert(row).select('id').single();
  return { id: check(res, `${table} ${row[key]}`).id, created: !existing };
}

export async function idBy(db, table, key, value) {
  const r = check(await db.from(table).select('id').eq(key, value).maybeSingle(), `${table} lookup`);
  if (!r) throw new Error(`${table} with ${key}=${value} not found`);
  return r.id;
}

/** Apply an upsert document ({papers, model_components, weekly_updates, experiments, milestones}). */
export async function applyUpserts(db, data, log = console.log) {
  for (const { categories, ...p } of data.papers ?? []) {
    const { id } = await upsertBy(db, 'papers', 'slug', p);
    if (categories) {
      check(await db.from('paper_category_links').delete().eq('paper_id', id), 'clear categories');
      if (categories.length) check(await db.from('paper_category_links').insert(categories.map((c) => ({ paper_id: id, category_slug: c }))), 'categories');
    }
    log(`paper ${p.slug}`);
  }
  for (const c of data.model_components ?? []) {
    const { thrust_slug, ...row } = c;
    if (thrust_slug) row.thrust_id = await idBy(db, 'research_thrusts', 'slug', thrust_slug);
    await upsertBy(db, 'model_components', 'slug', row);
    log(`component ${c.slug}`);
  }
  const weekIds = {};
  for (const w of data.weekly_updates ?? []) {
    const { component_slugs, ...row } = w;
    const { id, created } = await upsertBy(db, 'weekly_updates', 'week_start', row);
    if (created && !row.status) check(await db.from('weekly_updates').update({ status: 'draft' }).eq('id', id), 'draft');
    weekIds[w.week_start] = id;
    if (component_slugs) {
      check(await db.from('weekly_update_components').delete().eq('weekly_update_id', id), 'clear components');
      for (const s of component_slugs) {
        check(await db.from('weekly_update_components').insert({ weekly_update_id: id, model_component_id: await idBy(db, 'model_components', 'slug', s) }), `link component ${s}`);
      }
    }
    log(`week ${w.week_start}`);
  }
  for (const e of data.experiments ?? []) {
    const { component_slug, metrics, weeks, ...row } = e;
    if (component_slug) row.model_component_id = await idBy(db, 'model_components', 'slug', component_slug);
    const { id } = await upsertBy(db, 'experiments', 'code', row);
    if (metrics) {
      check(await db.from('experiment_metrics').delete().eq('experiment_id', id), 'clear metrics');
      if (metrics.length) check(await db.from('experiment_metrics').insert(metrics.map((m, i) => ({ sort_order: i * 10, ...m, experiment_id: id }))), 'metrics');
    }
    for (const ws of weeks ?? []) {
      const wid = weekIds[ws] ?? (await idBy(db, 'weekly_updates', 'week_start', ws));
      check(await db.from('weekly_update_experiments').upsert({ weekly_update_id: wid, experiment_id: id }, { onConflict: 'weekly_update_id,experiment_id', ignoreDuplicates: true }), 'link week');
    }
    log(`experiment ${e.code}`);
  }
  for (const m of data.milestones ?? []) {
    await upsertBy(db, 'milestones', 'slug', m);
    log(`milestone ${m.slug}`);
  }
  return { weekIds };
}
