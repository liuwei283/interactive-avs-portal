# AGENTS.md — maintaining the research portal

Read this before changing code or content in this repository. It is the operating manual for coding agents and human maintainers.

## 0. Four separate things: keep them separate

| # | What | Where it lives | Who changes it |
|---|---|---|---|
| 1 | **Scientific project context**: motivation, formulation, plans, open questions | `../PROJECT_CONTEXT.md` (workspace root, outside this repo); proposal PDF and slides | Researchers. Agents never change scientific claims without an explicit, dated team decision |
| 2 | **Website implementation**: code, schema, deployment | this repo (`src/`, `supabase/migrations/`, `scripts/`, `.github/`); spec in `../WEBSITE_SPEC.md` | Agents and developers via normal code changes |
| 3 | **Research experiment data**: code, configs, checkpoints, raw results | the experiment repositories in the research workspace and approved compute storage | Researchers. The website **links to** or **summarizes** them and is never their only copy |
| 4 | **Published website content**: overview text, papers, weeks, experiment summaries, metrics, uploaded files | Supabase (Postgres + private Storage), loaded via the admin UI or `scripts/*.mjs` from `private/` | The admin. Agents only on explicit instruction, with real data |

The website renders records; it is **not** the system of record for science. Anything important must also exist in (1) or (3).

## 1. Hard rules

1. **Never fabricate** results, metrics, figures, demos, meeting notes, dates, milestones, publications or paper metadata. If something is unknown, leave it empty or label it as such.
2. **Never commit** `private/`, `.env*` (except `.env.example`), PDFs, PPTX, audio, video, checkpoints, or anything from partner/unpublished sources. CI fails if you do. The repository is assumed **public**.
3. **Never put research content in `src/` or `public/`.** Everything served by GitHub Pages is public. Research text belongs in Supabase, not in code.
4. **Never use or request a Supabase service-role / secret key** in the app, the scripts or CI. Scripts sign in as the admin with the anon key, so RLS applies.
5. **Never weaken RLS.** Every new table needs RLS enabled, the `is_admin()` policy, `grant … to authenticated`, and new checks in `tests/db/rls.test.mjs`.
6. **Do not deploy** without the owner's explicit approval (deploy is opt-in via `PAGES_DEPLOY_ENABLED` or a manual workflow run).
7. Keep **plans visually distinct from evidence**. Model pages tag sections "design / plan" vs "recorded evidence". Do not mark a component `complete` without linked evidence.
8. Do not add results from the experiment repositories to the website unless the owner explicitly asks for that specific content.
9. Industry-partner collaboration: do not add partner names, logos, personnel, units, or endorsement language without written approval. Partner material is restricted.

## 2. Architecture

```
Browser (GitHub Pages, static SPA)                   Supabase
┌───────────────────────────────┐   anon key + JWT   ┌────────────────────────────┐
│ React + Vite + Tailwind        │ ────────────────▶ │ Auth (one admin user)       │
│ /login (only public page)      │                   │ Postgres + RLS (is_admin()) │
│ Overview Survey Documents      │ ◀──── rows ────── │ Storage: research-files     │
│ Weekly Progress Models Admin   │ ◀─ signed URLs ── │   (private, 50 MB/file)     │
└───────────────────────────────┘                    └────────────────────────────┘
```

- `src/lib/config.ts` reads only public `VITE_*` vars. `src/lib/supabase.ts` creates the single client.
- `src/lib/auth.tsx`: username `admin` → `VITE_ADMIN_EMAIL` → `signInWithPassword`, then `rpc('is_admin')`. A non-admin is signed out immediately.
- `src/components/layout/RequireAuth.tsx` is a UX guard only. Security is RLS.
- `src/lib/api.ts`: all read hooks (TanStack Query) + `invalidateAll()` after writes.
- `src/lib/storage.ts`: validation → (SVG sanitize) → XHR upload (< 6 MB) or TUS resumable (≥ 6 MB) → `assets` row; replace keeps the asset id and records `asset_versions`; delete refuses while `asset_references()` finds usages.
- Routing: `BrowserRouter` with `basename = import.meta.env.BASE_URL`; `dist/404.html` (copy of index) gives deep links on Pages.

Routes: `/` · `/survey` · `/survey/:slug` · `/documents` · `/documents/:slug` · `/progress` · `/progress/:weekStart` · `/models` · `/models/:slug` · `/experiments/:code` · `/admin/*` (weekly, experiments, models, documents, papers, assets, overview, milestones) · `/login`.

## 3. Database schema (see `supabase/migrations/`)

| Table | Key | Purpose |
|---|---|---|
| `app_admins` | `user_id` | the authorization list (write only via SQL editor) |
| `site_settings` | `id = 1` | Overview: title, affiliation, collaboration, team, motivation, hypothesis, objectives, architecture text + diagram asset |
| `research_thrusts` | `slug` | Part I/II/III (extensible); summary + formulation (Markdown/LaTeX) |
| `model_components` | `slug` | per-component page: overview, motivation, architecture, implementation, training config, results commentary, limitations, planned; `status` |
| `experiments` | `code` (stable ID, e.g. `EXP-0003`) | reusable experiment record; FK `model_component_id` |
| `experiment_metrics` | — | condition × metric values with unit, split, direction, baseline flag |
| `weekly_updates` | `week_start` (Monday, unique) | sections A–F as Markdown fields; `status` draft/published |
| `weekly_update_experiments` | (week, experiment) | many-to-many with per-week note |
| `weekly_update_components` | (week, component) | many-to-many |
| `documents` | `slug` | file + optional PDF preview asset, category, version, thrust, week |
| `document_versions` | — | previous files of a document |
| `papers` | `slug` | survey entry; `reading_status`, `publication_status`, `team_prior_work`, `source_note` |
| `survey_categories` / `paper_category_links` | `slug` / pair | multi-category tagging |
| `milestones` | `slug` | proposal quarters (relative) + optional target date |
| `assets` / `asset_versions` | `id` | every uploaded file (storage path, kind, tags); history of replaced files |
| `content_asset_links` | — | attach an asset to any record with role, label, comparison `group_key`, caption; `ON DELETE RESTRICT` |

Function `asset_references(uuid)` lists explicit attachments, document files and inline Markdown embeds of an asset.

When you change the schema, also update `src/lib/types.ts`, the editors, `tests/unit/fakeSupabase.ts` (text defaults), `tests/db/*.mjs`, this table and `../WEBSITE_SPEC.md`.

## 4. File storage organization

Bucket `research-files` (private). Keys: `<area>/<yyyy-mm>/<random>-<safe-name>.<ext>`, areas `weekly/<week>`, `experiments/<code>`, `models/<slug>`, `documents`, `documents/previews`, `library`, `overview`, `inline`. Pages reference **asset ids**, never paths, so files can be replaced without breaking references. Accepted: pdf, pptx, png, jpg/jpeg, webp, gif, svg (sanitized), mp4, webm, wav, mp3, flac, json, csv; ≤ 50 MB.

## 5. Commands

```bash
# Node 22 (+ PostgreSQL for test:db), e.g. conda create -p <env> -c conda-forge nodejs=22 postgresql
export PATH=<env>/bin:$PATH
npm install
npm run dev                         # local dev (needs .env.local)
npm test                            # unit + UI-flow tests (no backend)
npm run test:db                     # RLS / schema / seed tests on throwaway Postgres
npm run build                       # typecheck + build + 404.html + bundle security scan
BASE_PATH=/<repo>/ npm run build && BASE_PATH=/<repo>/ npm run preview:pages
npm run seed [-- --overwrite]       # private/seed/content.mjs → Supabase (as admin)
npm run import:files [-- --replace] # private/seed/files.mjs → Documents (as admin)
npm run upsert -- --file <json>     # structured upserts by natural key (as admin)
npm run sync:week -- <folder>       # publish ../weekly_reports/<Monday>/ (week.md + media) as a draft
```

Optional visual check with fake data (no backend): `npx vite build --config tests/visual/vite.config.ts --outDir <scratch>`, then serve it with `DIST_DIR=<scratch> BASE_PATH=/visual/ node scripts/serve-pages.mjs 4174`.

Before finishing any change: `npm test`, `npm run test:db` (if schema/policies changed), `npm run build`. Report exactly what ran and what did not.

## 6. Deployment

`.github/workflows/pages.yml`: on every push/PR it runs the repo guard (no private files tracked), `npm ci`, `npm test`, DB tests, and `npm run build` with `BASE_PATH=/<repo>/` and `VITE_*` from repository **variables**. It deploys only on `main` when `vars.PAGES_DEPLOY_ENABLED == 'true'` or on a manual run with `deploy = true`. Never enable either without the owner's approval. Never claim a deployment happened until the Actions run is green.

## 7. Content workflows

### Add a weekly update
- **Agent-written report (preferred for agents):** follow `../weekly_reports/README.md`. Create `../weekly_reports/<Monday>/week.md` + media from the artifacts the owner points to, run `npm run sync:week -- <folder> --dry-run`, then `npm run sync:week -- <folder>` (draft). Publish only when told. Report the page path and what was uploaded. The report is stored in `weekly_updates.report_md` and rendered above the optional A–F sections.
- **UI (preferred):** Admin → New weekly update → pick any date (mapped to Monday) → fill tabs A–F → attach slides/demos → link experiments → Save draft / Save and publish.
- **Agent:** write `private/updates/<week>.json` with only real, owner-provided content, e.g.
  ```json
  { "weekly_updates": [{ "week_start": "2026-11-09", "status": "draft", "research_focus": "…", "summary_md": "…",
      "component_slugs": ["v2a-baseline-reproduction"] }] }
  ```
  then `npm run upsert -- --file private/updates/<week>.json`. Keep `status: "draft"` unless the owner says to publish. Files (slides, audio, video) are uploaded through the admin UI, or added to a `private/seed/files.mjs`-style manifest and imported with `npm run import:files -- --file <manifest>`.

### Update model results
1. Create or update an **experiment record** (stable `code`; never reuse codes) with dataset/split, checkpoint, config (commit hash, config path, seed, hardware), status, observations, conclusions and limitations.
2. Enter **metrics** exactly as measured (condition label, baseline flag, unit, split, direction). Use `"metrics": [...]` in an upsert file to replace them.
3. Attach figures/audio/video to the experiment, with clear labels and a shared `group_key` for A/B or side-by-side comparisons.
4. Link the experiment to the relevant week(s) (`"weeks": [...]`). It then appears on those weeks and on its component page.
5. Change `model_components.status` only when the evidence supports it, and update `limitations_md` / `planned_md`.

### Add a research reference
- **UI:** Admin → Survey papers → Add paper. Fill in metadata *as published*, categories, status, summary, contributions, relevance and notes, and record `source_note`.
- **Agent:** `{ "papers": [{ "slug": "…", "title": "…", "authors": "…", "venue": "…", "year": 2026, "paper_url": "https://…", "categories": ["v2a"], "source_note": "…" }] }` → `npm run upsert`. Verify metadata from the actual paper page. If you cannot verify a field, leave it empty.
- New category: Admin → Overview & thrusts → Survey categories.

### Add a model component or thrust
Admin → Model components → New component (choose thrust, slug, status), or Admin → Overview & thrusts. No code changes are needed; pages are generated from the template.

## 7a. Live verification checklist

These items could not be verified when the site was built (no live Supabase). After first setup, confirm:

1. `/login` with a wrong password shows "Incorrect username or password." and the right one lands on Overview.
2. In a private window, calling `GET <SUPABASE_URL>/rest/v1/papers?select=*` with only the anon key returns `[]` or a permission error.
3. Upload a small PNG and a > 6 MB MP4 (resumable path), and confirm both preview.
4. Copy a signed URL, wait more than 1 hour, and confirm it no longer works. A bucket URL without a token must fail.
5. Replace a file and confirm the weekly page still shows it. Deleting an attached file must be refused.
6. On the deployed Pages URL, a deep link such as `/<repo>/progress/<week>` loads after login.

## 8. Code conventions

- TypeScript strict; functional React components; Tailwind utilities, with shared classes (`card`, `btn-*`, `input`, `label`, `eyebrow`, `prose-research`) defined as `@utility` in `src/index.css`.
- Design: white background, slate text, a single restrained accent (`accent-*`), no decorative animation.
- Every list/detail page needs loading, error and **honest empty** states ("No verified results recorded yet").
- New media types go through `AssetView` / `AttachmentGroups`; comparisons require explicit labels.
- Add tests for new logic in `tests/unit/`, and for new schema in `tests/db/`.
