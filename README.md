# Research Collaboration Portal

A login-protected research workspace for tracking progress, organizing literature, reviewing experiments, presenting audio-visual demos and preparing weekly meetings. The frontend is a static single-page app hosted on **GitHub Pages**. Authentication, the database and file storage are on **Supabase**, with access enforced server-side by Row Level Security.

> **Privacy model in one sentence:** the GitHub Pages site and this repository contain only application code and a login page. Every piece of research content (text, papers, slides, PDFs, audio, video, results) lives in Supabase and is returned **only** to the authenticated administrator.

Sections: **Overview · Survey · Documents · Weekly Progress · Models**, plus an **Admin** dashboard.

---

## Contents

1. [Tech stack](#tech-stack)
2. [Repository structure](#repository-structure)
3. [Local setup](#local-setup)
4. [Environment variables](#environment-variables)
5. [Supabase project setup](#supabase-project-setup)
6. [Initial administrator provisioning](#initial-administrator-provisioning)
7. [Database migrations](#database-migrations)
8. [Storage bucket](#storage-bucket)
9. [Content initialization (seed + file import)](#content-initialization)
10. [GitHub Pages deployment](#github-pages-deployment)
11. [Weekly workflow: adding an update](#weekly-workflow)
12. [Uploading documents and demos](#uploading-documents-and-demos)
13. [Markdown reference](#markdown-reference)
14. [Testing](#testing)
15. [Limits: storage, file size, video](#limits)
16. [Security notes](#security-notes)
17. [Troubleshooting](#troubleshooting)

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18, TypeScript, Vite 6, Tailwind CSS 4 (+ typography) |
| Routing | React Router 6 (`BrowserRouter` with the Pages subpath as basename; `404.html` SPA fallback) |
| Data | Supabase JS v2 (PostgREST), TanStack Query |
| Auth | Supabase Auth email/password. The fixed username `admin` maps to `VITE_ADMIN_EMAIL` |
| Files | Supabase Storage, private bucket `research-files`, short-lived signed URLs; TUS resumable uploads for files ≥ 6 MB |
| Content | Structured Postgres records plus Markdown (GFM tables, code, KaTeX math, embedded files) |
| Hosting | GitHub Pages via GitHub Actions (static, no server) |
| Tests | Vitest + Testing Library (logic and full UI flows); real Postgres for RLS/schema |

## Repository structure

```text
research-portal/
├── AGENTS.md                      # maintenance guide for coding agents (read first)
├── README.md
├── .env.example                   # public build-time config template
├── .github/workflows/pages.yml    # CI + opt-in GitHub Pages deploy
├── index.html, vite.config.ts, tsconfig*.json, package.json
├── public/                        # favicon, robots.txt (noindex). NO research files.
├── src/
│   ├── main.tsx, App.tsx          # router + route table
│   ├── lib/                       # config, supabase client, auth, api hooks, storage,
│   │                              # types, file validation, dates, markdown refs
│   ├── components/
│   │   ├── layout/                # header/nav, breadcrumbs, route guard
│   │   ├── content/               # Markdown renderer, cards, experiment summary
│   │   ├── media/                 # audio, video, A/B audio, synced video compare,
│   │   │                          # image compare/gallery, PDF preview, metric table/bars
│   │   └── admin/                 # Markdown editor, dropzone, asset picker,
│   │                              # attachments editor, form hook, save bar
│   └── pages/                     # Overview, Survey, Documents, Weekly, Models,
│       └── admin/                 # Experiment pages + all admin editors
├── supabase/migrations/           # schema, RLS, storage bucket + policies (SQL)
├── scripts/
│   ├── seed.mjs                   # load structured seed content (as admin)
│   ├── import-files.mjs           # upload local files as Documents (as admin)
│   ├── postbuild.mjs              # writes 404.html/.nojekyll, runs bundle scan
│   ├── check-bundle.mjs           # fails build on secrets / private files in dist/
│   ├── serve-pages.mjs            # local GitHub-Pages-like static server
│   └── lib/admin-client.mjs
├── tests/
│   ├── unit/                      # vitest: lib, components, full app flows
│   ├── db/                        # Postgres RLS + integrity + seed validation
│   └── visual/                    # optional screenshot build with fake data
└── private/                       # GIT-IGNORED: seed content + local files. Never commit.
    ├── seed/content.mjs           # overview, thrusts, components, papers, milestones
    ├── seed/files.mjs             # which local files to import as Documents
    └── files/                     # e.g. the PDF export of the proposal slides
```

The scientific reference documents live **outside** this repository, in the research workspace (`../PROJECT_CONTEXT.md`, `../WEBSITE_SPEC.md`, the proposal PDF and slides). See [AGENTS.md](AGENTS.md).

## Local setup

Requirements: Node.js 20+ (22 recommended) and npm; PostgreSQL binaries only for `npm run test:db`. Without root access, conda works: `conda create -p <env> --override-channels -c conda-forge nodejs=22 postgresql`.

```bash
export PATH=<env>/bin:$PATH          # if Node came from conda
cd research-portal
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run dev                     # http://localhost:5173
```

Without `.env.local`, the app shows a "Backend not configured" page. That is expected.

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck, production build, `404.html`, bundle security scan |
| `BASE_PATH=/<repo>/ npm run build` | Build for a GitHub Pages subpath |
| `BASE_PATH=/<repo>/ npm run preview:pages` | Serve `dist/` like GitHub Pages at `http://localhost:4173/<repo>/` |
| `npm test` | Unit + UI-flow tests (no backend needed) |
| `npm run test:db` | RLS/schema tests on a throwaway local Postgres (`initdb`, `pg_ctl`, `psql` on PATH) |
| `npm run typecheck` | TypeScript only |
| `npm run seed` / `npm run import:files` | Content initialization (see below) |
| `npm run sync:week -- <folder>` | Publish an agent-written weekly report folder (see Weekly workflow) |

## Environment variables

All `VITE_*` values are **compiled into the public JavaScript bundle**. They are public by design. Security comes from RLS, not from hiding them.

| Variable | Required | Meaning |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | yes | The **anon / publishable** key. *Never* the `service_role` / secret key |
| `VITE_ADMIN_EMAIL` | yes | Email of the Supabase Auth user that the username `admin` maps to |
| `VITE_SITE_TITLE` | no | Title on the login page and browser tab (default "Research Portal"). Keep it generic if the project name is confidential |
| `VITE_MAX_UPLOAD_MB` | no | Client-side per-file limit (default 50; must not exceed the bucket limit) |
| `BASE_PATH` | build only | GitHub Pages subpath, e.g. `/interactive-avs-portal/` |
| `PROTECTED_PATTERNS` | build only | Optional comma-separated terms (project names, people, file titles) that make the build fail if they appear in `dist/`. Store it as a GitHub Actions **secret** |
| `PORTAL_ADMIN_PASSWORD` | scripts only | Optional, for non-interactive `seed`/`import:files`; otherwise you are prompted. Never commit it |

The build fails if a service-role JWT, an `sb_secret_…` key, or a private file type ends up in `dist/` (`scripts/check-bundle.mjs`).

## Supabase project setup

1. Create a free project at <https://supabase.com> (choose a region close to your users, e.g. `us-east-1`).
2. **Authentication → Sign In / Providers → Email:** keep Email enabled and **turn off "Allow new users to sign up"**. Disabling "Confirm email" is optional; the admin user is created already confirmed.
3. Apply the migrations ([below](#database-migrations)).
4. Create the administrator ([below](#initial-administrator-provisioning)).
5. Copy **Project URL** and **anon/publishable key** from *Settings → API* into `.env.local`, and set `VITE_ADMIN_EMAIL`.

## Initial administrator provisioning

The portal has exactly one identity: username **`admin`**, which maps to `VITE_ADMIN_EMAIL`. Its password is stored only in Supabase Auth (bcrypt-hashed). It is never in this repo or the bundle.

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**
   - Email: the address you put in `VITE_ADMIN_EMAIL` (it does not need to receive mail)
   - Password: a strong password of your choice (≥ 12 characters)
   - Check **Auto Confirm User**
2. **SQL Editor**, run once (replace the email):
   ```sql
   insert into public.app_admins (user_id)
   select id from auth.users where email = 'admin@example.org';
   ```
   Only users in `public.app_admins` can read or write anything. The table cannot be written through the API, so nobody can promote themselves.
3. Sign in at `/login` with username `admin` and that password.

To change the password later, use **Admin → Dashboard → Change admin password** while signed in.

## Database migrations

SQL files in `supabase/migrations/` must be applied **in filename order**:

1. `20261105000000_initial_schema.sql`: tables, indexes, triggers, the `asset_references()` helper, RLS policies, grants
2. `20261105000100_storage.sql`: private bucket `research-files` and its storage policies

**Option A: Dashboard.** Open SQL Editor → New query, paste each file's contents, and run it.

**Option B: Supabase CLI.**
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push        # applies supabase/migrations/*
```

Future schema changes: add a new timestamped file (never edit an applied one), enable RLS on new tables, add the same `is_admin()` policy, and `grant … to authenticated`. Then extend `tests/db/rls.test.mjs`.

## Storage bucket

The migration creates **`research-files`** with `public = false`, a 50 MB per-file limit, and an allow-list of MIME types (PDF, PPTX, PNG/JPG/WebP/GIF/SVG, MP4/WebM, WAV/MP3/FLAC, JSON/CSV). Storage policies allow select/insert/update/delete only to `authenticated` callers for whom `is_admin()` is true.

Objects are organized as `<area>/<yyyy-mm>/<random>-<name>.<ext>`, e.g. `weekly/2026-11-02/2026-11/3fa9c1d2e4b5-slides.pdf`, `experiments/EXP-0003/…`, `documents/…`, `library/…`. Paths are never shown to viewers. Pages reference files by **asset id**, and the browser obtains a signed URL valid for 1 hour after login. Direct object URLs without a valid signature return an error.

## Content initialization

Unpublished research content is **not** in the repository. It lives in the git-ignored `private/` folder and is loaded into Supabase by scripts that sign in **as the admin** (anon key + admin password). They never use a service-role key.

```bash
# 1. Structured content from PROJECT_CONTEXT.md + the proposal:
#    overview text, team, 3 research thrusts, 26 model components (status "Planned"),
#    9 survey categories, 16 papers from the proposal reference list, Q1–Q4 milestones.
npm run seed -- --dry-run      # shows counts
npm run seed                   # inserts only what is missing; safe to re-run
npm run seed -- --overwrite    # re-applies seeded text (never resets statuses/reading progress)

# 2. Existing files → Documents (private bucket):
#    the proposal PDF and the slides PPTX (+ its PDF export for inline preview).
npm run import:files           # skips documents that already exist
```

Neither script creates weekly updates, experiments, metrics or results. Those start empty, with clearly labeled empty states.

Paper metadata comes from the proposal's reference list. URLs are left blank unless the reference contained one; verify and fill them in (Admin → Survey papers).

## GitHub Pages deployment

> Nothing is deployed until you explicitly enable it.

1. Create a GitHub repository, e.g. `interactive-avs-portal`, and push this folder:
   ```bash
   git add -A && git status    # confirm no private/ files, PDFs, PPTX or .env* are staged
   git commit -m "Research portal v1"
   git remote add origin git@github.com:<username>/interactive-avs-portal.git
   git push -u origin main
   ```
   On GitHub Free, Pages requires a **public** repository. That is acceptable here because the repo holds no research content. With GitHub Pro (free via GitHub Education), the repo can be private, but the **Pages site itself is always publicly reachable**. Only the login page is visible without credentials.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, and optionally `VITE_SITE_TITLE` and `VITE_MAX_UPLOAD_MB`. Optionally add a **secret** `PROTECTED_PATTERNS` (e.g. team names, project title, partner name) so the build fails if any of them leak into the bundle.
4. CI (tests, DB tests, build, bundle scan) now runs on every push.
5. **To deploy:** either set the repository variable `PAGES_DEPLOY_ENABLED` = `true` (deploys every push to `main`), or run the workflow manually (Actions → *CI and GitHub Pages* → Run workflow → deploy ✓).
6. The site appears at `https://<username>.github.io/<repo>/`. The workflow sets `BASE_PATH=/<repo>/` automatically. Deep links such as `/<repo>/progress/2026-11-02` work through `404.html`.

The Supabase Auth "Site URL" does not matter for password login. You may set it to the Pages URL.

## Weekly workflow

### Option 1 — agent-written report (recommended)

A coding agent writes `../weekly_reports/<Monday>/week.md` plus media (free-form Markdown with
`compare-audio`, `compare-video`, `compare-image`, `gallery` and `metrics` blocks), then:

```bash
npm run sync:week -- ../weekly_reports/2026-11-09 --dry-run   # validate
npm run sync:week -- ../weekly_reports/2026-11-09             # upload + draft page (live immediately)
```

No git push is needed: content goes straight to Supabase. Review the draft on the site and publish.
The format and the rules for agents are in `weekly_reports/README.md` (outside this repo). For
unattended runs, put `PORTAL_ADMIN_PASSWORD=…` in `.env.local` (git-ignored; keep it `chmod 600`).

### Option 2 — manual, in the browser

1. **Admin → New weekly update** (or the button on Weekly Progress).
2. Pick **any date in the week**. It is mapped to that week's Monday, which becomes the URL `/progress/YYYY-MM-DD`. Optionally pre-fill goals from last week's next steps.
3. Fill in the tabs, all in Markdown:
   - **A. Overview:** summary, goals, accomplishments
   - **B. Meeting materials:** upload slides (PDF previews inline; PPTX downloads, so also upload the PDF export), agenda, questions
   - **C. Experiments & results:** link existing experiment records or *Create new experiment for this week*; attach figures, audio and video; free-form results
   - **D. Challenges & findings**, **E. Next steps**, **F. Meeting notes** (decisions, action items)
4. **Save draft** at any time, then **Save and publish**. The week appears in the index (drafts show a *draft* badge and can be hidden).

An experiment's metrics and demos are stored once on the **experiment record** and appear automatically on every week that links it and on its model component page.

## Uploading documents and demos

- **Documents:** Admin → Documents → Upload document. Choose a category (proposal, proposal slides, weekly slides, design doc, architecture, research note, other), version, date, thrust and optional week. **Replace file** keeps the old file in version history.
- **Files & demo assets:** Admin → Files. Drag and drop multiple files, then set category and tags. *Manage* a file to edit its metadata, copy a Markdown embed, see where it is used, **replace** it (all references keep working), archive it, or delete it. Deletion is refused while anything references the file.
- **Attach to a page:** in weekly, experiment and component editors, use *Attach / upload file* and set role, **label** (e.g. "Ours", "Baseline: MMAudio", "Ground truth") and **comparison group**:
  - ≥ 2 audio files in the same group → **A/B player** (switch with keys 1–9, playback position kept)
  - ≥ 2 videos in the same group → **synchronized side-by-side** with a "listen to" selector
  - exactly 2 images in the same group → **before/after slider**
- **Metrics:** experiment editor → *Evaluation metrics*. Record condition, baseline flag, value, unit, direction (higher/lower is better) and split. Values are shown exactly as entered and never aggregated across experiments.

## Markdown reference

Every long-text field supports GitHub-flavored Markdown with *Write / Preview*:

| Syntax | Result |
|---|---|
| `$E = mc^2$`, `$$A = F(O_1,O_2,I(t))$$` | KaTeX math |
| `![caption](asset:<uuid>)` | Embed an uploaded image, audio, video or PDF ("Insert file" button) |
| `[EXP-0003](exp:EXP-0003)` | Link to an experiment record |
| `[proposal](doc:<slug>)` · `[paper](paper:<slug>)` · `[week](week:2026-11-02)` · `[component](model:<slug>)` | Internal links |
| tables, task lists `- [ ]`, fenced code | GFM |

Raw HTML is not rendered, and `javascript:`/`data:` links are stripped.

## Testing

| Suite | Command | What it covers |
|---|---|---|
| Logic + components | `npm test` | username mapping, auth errors, week dates, upload validation, storage paths, Markdown safety/math/links, survey filtering, metric table |
| UI flows | `npm test` | real `<App>` against an in-memory Supabase fake: protected-route redirect, wrong password/username, login/logout, navigation across all five sections, survey filters, creating a weekly update from any date, linking an experiment, publishing, reverse links on the model page, duplicate-week guard, experiment ID suggestion |
| Database | `npm run test:db` | 61 checks on real Postgres: anon has no access to any table, functions or files; a non-admin user sees 0 rows and cannot write or self-promote; admin CRUD; storage policies limited to the private bucket; Monday/unique-week constraints; asset delete protection; `asset_references()`; seed content validity |
| Bundle | `npm run build` | no secrets, service-role JWTs, PDFs, media or seed content in `dist/` |

**Not yet tested against a live Supabase project** (no credentials were available when this was built): real sign-in, real storage uploads (standard and TUS resumable), signed-URL playback of real media, and the deployed Pages URL. Run through the checklist in [AGENTS.md → Live verification](AGENTS.md#7a-live-verification-checklist) after setup.

## Limits

Check <https://supabase.com/pricing> and GitHub's docs for current numbers. At the time of writing:

| Resource | Free-tier limit | Implication |
|---|---|---|
| Supabase file storage | 1 GB total | Includes replaced versions. Delete unused versions/assets when space is tight |
| Supabase max file size | 50 MB per file | Matches the bucket limit and `VITE_MAX_UPLOAD_MB`. Paid plans can raise both |
| Supabase egress | ~5 GB / month | Each view of a video downloads it. Keep demo clips short and compressed |
| Supabase database | 500 MB | Plenty for text/metadata |
| Supabase inactivity | Free projects pause after ~1 week without activity | Restore from the dashboard. Data is kept |
| GitHub Pages | 1 GB site, ~100 GB/month soft bandwidth | The site is only ~1.5 MB of code |

**Video guidance:** transcode demos to H.264 MP4 (or VP9 WebM), ≤ 1080p, short clips, e.g.
`ffmpeg -i in.mov -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 160k -movflags +faststart out.mp4`.
Files ≥ 6 MB upload with resumable (TUS) uploads, which survive brief network drops. For longer recordings, store them in approved university storage and link them from Markdown.

## Security notes

- The anon key + RLS model: the bundle contains only the public anon key. Without a valid admin JWT, every table returns zero rows / permission denied, and storage refuses objects. The client-side route guard is only for UX.
- `public.app_admins` is the single source of authorization. No API path writes to it.
- Private bucket with signed URLs (1 h). SVGs are sanitized with DOMPurify on upload and displayed only through `<img>`, so scripts cannot run.
- `robots.txt` disallows indexing, and pages carry `noindex`.
- The repo must never contain `private/`, `.env*` (except `.env.example`), PDFs, PPTX or media. `.gitignore` and the CI guard enforce this. If something sensitive is ever committed, rotate it and rewrite history; `.gitignore` alone does not remove it.
- Treat industry-partner material and unpublished results as restricted. They belong only in Supabase, never in the repo.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Backend not configured" | `.env.local` (local) or the GitHub Actions variables (deploy) are missing. Rebuild after setting them |
| "Incorrect username or password." | Username must be `admin`. Check the password and that `VITE_ADMIN_EMAIL` matches the Auth user exactly |
| "This account is not authorized…" | Run the `insert into public.app_admins …` statement for that user |
| "authorization check failed … migrations" | `is_admin()` is missing. Apply the migrations in order |
| Pages loads but every page is empty | Data is empty (run `npm run seed`), or migrations were applied to a different project than `VITE_SUPABASE_URL` |
| 404 on refresh/deep link on Pages | `dist/404.html` must exist (it is created by `npm run build`). Check `BASE_PATH` matches the repo name |
| Assets load from `/assets/…` instead of `/<repo>/assets/…` | Build without `BASE_PATH`. The Actions workflow sets it automatically |
| Upload: "exceeds the storage size limit" | File > 50 MB. Compress it, or raise the bucket limit on a paid plan *and* `VITE_MAX_UPLOAD_MB` |
| Upload: "Not authorized to upload" | Session expired. Sign in again |
| PPTX shows no preview | Expected. Upload a PDF export as the preview (`soffice --headless --convert-to pdf file.pptx`) |
| "This file is still used by …" on delete | Detach it from those pages / remove the Markdown embed first, or *Archive* instead |
| Site down after a quiet week | The free Supabase project paused. Restore it in the dashboard |
