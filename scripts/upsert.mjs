#!/usr/bin/env node
// Upsert content records from a JSON file using natural keys. Intended for
// coding agents and batch edits; signs in as admin (RLS applies).
//
//   npm run upsert -- --file private/updates/2026-11-02.json [--dry-run]
//
// File shape (every section optional):
// {
//   "papers":       [{ "slug": "...", "title": "...", ..., "categories": ["v2a"] }],
//   "experiments":  [{ "code": "EXP-0003", "name": "...", "component_slug": "v2a-baseline-reproduction",
//                      "status": "completed", ..., "metrics": [ { "metric_name": "...", "condition_label": "...",
//                      "value": 1.23, "unit": "", "higher_is_better": false, "split": "test", "is_baseline": false } ],
//                      "weeks": ["2026-11-02"] }],
//   "weekly_updates": [{ "week_start": "2026-11-02", "status": "draft", "summary_md": "...", ...,
//                        "component_slugs": ["..."] }],
//   "model_components": [{ "slug": "...", "status": "in_progress", "implementation_md": "..." }],
//   "milestones":   [{ "slug": "...", "status": "active" }]
// }
// Rules: only the fields you provide are written. "metrics" REPLACES that
// experiment's metric rows. Weekly pages are created as drafts unless
// "status": "published" is given. Never put fabricated numbers here.
import { readFileSync } from 'node:fs';
import { adminClient } from './lib/admin-client.mjs';
import { applyUpserts } from './lib/upsert-lib.mjs';

const args = process.argv.slice(2);
const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
if (!file) {
  console.error('Usage: npm run upsert -- --file <json> [--dry-run]');
  process.exit(2);
}
const data = JSON.parse(readFileSync(file, 'utf8'));
const summary = Object.entries(data).map(([k, v]) => `${v.length} ${k}`).join(', ');
console.log(`Upserting: ${summary}`);
if (args.includes('--dry-run')) process.exit(0);
const db = await adminClient();

await applyUpserts(db, data);
console.log('Done.');
process.exit(0);
