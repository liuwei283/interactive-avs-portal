-- Free-form weekly report written by a coding agent (or by hand) and
-- published with `npm run sync:week`. Rendered at the top of the week page.
alter table public.weekly_updates
  add column if not exists report_md text not null default '',
  add column if not exists report_source text not null default '';   -- e.g. folder the report was synced from

-- Content hash so re-syncing a week does not upload identical files twice.
alter table public.assets
  add column if not exists sha256 text;
create index if not exists assets_sha256_idx on public.assets (sha256);
