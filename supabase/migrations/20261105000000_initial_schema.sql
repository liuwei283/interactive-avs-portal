-- =====================================================================
-- Research portal — initial schema
--
-- Security model
--   * Every table has Row Level Security enabled.
--   * The only policies grant access to the `authenticated` role AND only
--     when public.is_admin() is true (the caller's auth.uid() is listed in
--     public.app_admins). There are NO policies for `anon`, so the public
--     anon/publishable key can read nothing.
--   * public.app_admins itself has no write policy: an administrator can
--     only be registered from the SQL editor / service role (see README).
--
-- Content model
--   research_thrusts ─┬─< model_components ─< experiments ─< experiment_metrics
--                     │                         │
--   weekly_updates ───┼─< weekly_update_experiments >─┘
--                     └─< weekly_update_components >── model_components
--   documents ─< document_versions          (files live in `assets`)
--   papers ─< paper_category_links >─ survey_categories
--   assets ─< asset_versions
--   content_asset_links  (polymorphic: attach an asset to any record)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administrators and helper functions
-- ---------------------------------------------------------------------
create table public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Site-wide overview content (single row, id = 1)
-- ---------------------------------------------------------------------
create table public.site_settings (
  id                    smallint primary key default 1 check (id = 1),
  project_title         text not null default 'Research Project',
  short_title           text not null default '',
  affiliation           text not null default '',
  collaboration         text not null default '',
  team_md               text not null default '',
  motivation_md         text not null default '',
  objectives_md         text not null default '',
  hypothesis_md         text not null default '',
  architecture_md       text not null default '',
  architecture_asset_id uuid,
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Research thrusts (Part I / II / III, extensible)
-- ---------------------------------------------------------------------
create table public.research_thrusts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  numeral     text not null default '',
  title       text not null,
  summary_md  text not null default '',
  formulation_md text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Assets (every uploaded file). References point at the asset id, so a
-- file can be replaced without breaking pages that embed it.
-- ---------------------------------------------------------------------
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null default 'research-files',
  storage_path  text not null unique,
  filename      text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes >= 0),
  kind          text not null check (kind in ('image','svg','video','audio','pdf','pptx','data','other')),
  title         text not null default '',
  description   text not null default '',
  category      text not null default 'general',
  tags          text[] not null default '{}',
  version       integer not null default 1,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index assets_kind_idx on public.assets (kind);
create index assets_category_idx on public.assets (category);
create index assets_tags_idx on public.assets using gin (tags);
create index assets_created_idx on public.assets (created_at desc);

-- History of replaced files for an asset (old storage objects are kept).
create table public.asset_versions (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null references public.assets (id) on delete cascade,
  version      integer not null,
  storage_path text not null,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  unique (asset_id, version)
);

alter table public.site_settings
  add constraint site_settings_architecture_asset_fk
  foreign key (architecture_asset_id) references public.assets (id) on delete set null;

-- ---------------------------------------------------------------------
-- Model components (organised by thrust)
-- ---------------------------------------------------------------------
create table public.model_components (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  thrust_id          uuid references public.research_thrusts (id) on delete set null,
  title              text not null,
  summary            text not null default '',
  status             text not null default 'planned'
                       check (status in ('planned','exploring','in_progress','paused','complete','dropped')),
  overview_md        text not null default '',
  motivation_md      text not null default '',
  architecture_md    text not null default '',
  implementation_md  text not null default '',
  training_config_md text not null default '',
  results_md         text not null default '',
  limitations_md     text not null default '',
  planned_md         text not null default '',
  sort_order         integer not null default 0,
  published          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index model_components_thrust_idx on public.model_components (thrust_id, sort_order);

-- ---------------------------------------------------------------------
-- Experiments (reusable across Weekly Progress and Models)
-- ---------------------------------------------------------------------
create table public.experiments (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
  name               text not null,
  model_component_id uuid references public.model_components (id) on delete set null,
  research_question  text not null default '',
  hypothesis         text not null default '',
  dataset            text not null default '',
  model_checkpoint   text not null default '',
  config_md          text not null default '',
  experiment_date    date,
  status             text not null default 'planned'
                       check (status in ('planned','running','completed','failed','abandoned')),
  baseline_md        text not null default '',
  observations_md    text not null default '',
  conclusions_md     text not null default '',
  limitations_md     text not null default '',
  published          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index experiments_component_idx on public.experiments (model_component_id);
create index experiments_date_idx on public.experiments (experiment_date desc nulls last);

create table public.experiment_metrics (
  id               uuid primary key default gen_random_uuid(),
  experiment_id    uuid not null references public.experiments (id) on delete cascade,
  metric_name      text not null,
  condition_label  text not null default '',          -- e.g. "Ours", "MMAudio baseline"
  is_baseline      boolean not null default false,
  value            double precision,
  unit             text not null default '',
  higher_is_better boolean,
  split            text not null default '',
  notes            text not null default '',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);
create index experiment_metrics_exp_idx on public.experiment_metrics (experiment_id, sort_order);

-- ---------------------------------------------------------------------
-- Weekly updates — one row per week (week_start is a Monday)
-- ---------------------------------------------------------------------
create table public.weekly_updates (
  id                       uuid primary key default gen_random_uuid(),
  week_start               date not null unique check (extract(isodow from week_start) = 1),
  meeting_date             date,
  title                    text not null default '',
  status                   text not null default 'draft' check (status in ('draft','published')),
  -- A. Weekly overview
  research_focus           text not null default '',
  goals_md                 text not null default '',
  summary_md               text not null default '',
  accomplishments_md       text not null default '',
  -- B. Meeting materials
  agenda_md                text not null default '',
  discussion_questions_md  text not null default '',
  -- C. Experiments and results
  implementation_changes_md text not null default '',
  results_md               text not null default '',
  -- D. Challenges and findings
  issues_md                text not null default '',
  failed_experiments_md    text not null default '',
  hypotheses_md            text not null default '',
  lessons_md               text not null default '',
  uncertainties_md         text not null default '',
  -- E. Next steps
  planned_experiments_md   text not null default '',
  priorities_md            text not null default '',
  followups_md             text not null default '',
  open_questions_md        text not null default '',
  -- F. Meeting notes
  discussion_notes_md      text not null default '',
  decisions_md             text not null default '',
  action_items_md          text not null default '',
  published_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index weekly_updates_week_idx on public.weekly_updates (week_start desc);

create table public.weekly_update_experiments (
  weekly_update_id uuid not null references public.weekly_updates (id) on delete cascade,
  experiment_id    uuid not null references public.experiments (id) on delete cascade,
  note             text not null default '',
  sort_order       integer not null default 0,
  primary key (weekly_update_id, experiment_id)
);
create index weekly_update_experiments_exp_idx on public.weekly_update_experiments (experiment_id);

create table public.weekly_update_components (
  weekly_update_id   uuid not null references public.weekly_updates (id) on delete cascade,
  model_component_id uuid not null references public.model_components (id) on delete cascade,
  primary key (weekly_update_id, model_component_id)
);
create index weekly_update_components_comp_idx on public.weekly_update_components (model_component_id);

-- ---------------------------------------------------------------------
-- Documents (proposal, slides, design docs, ...)
-- ---------------------------------------------------------------------
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title             text not null,
  description       text not null default '',
  category          text not null default 'other'
                      check (category in ('proposal','proposal_slides','weekly_slides','design_doc',
                                          'architecture','research_note','other')),
  document_date     date,
  version           text not null default 'v1',
  tags              text[] not null default '{}',
  thrust_id         uuid references public.research_thrusts (id) on delete set null,
  weekly_update_id  uuid references public.weekly_updates (id) on delete set null,
  file_asset_id     uuid references public.assets (id) on delete restrict,
  preview_asset_id  uuid references public.assets (id) on delete set null,
  body_md           text not null default '',
  important         boolean not null default false,
  published         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index documents_category_idx on public.documents (category);
create index documents_week_idx on public.documents (weekly_update_id);
create index documents_tags_idx on public.documents using gin (tags);

create table public.document_versions (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.documents (id) on delete cascade,
  version          text not null,
  file_asset_id    uuid references public.assets (id) on delete restrict,
  preview_asset_id uuid references public.assets (id) on delete set null,
  note             text not null default '',
  created_at       timestamptz not null default now()
);
create index document_versions_doc_idx on public.document_versions (document_id, created_at desc);

-- ---------------------------------------------------------------------
-- Literature survey
-- ---------------------------------------------------------------------
create table public.survey_categories (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title       text not null,
  description text not null default '',
  sort_order  integer not null default 0
);

create table public.papers (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title              text not null,
  authors            text not null default '',
  venue              text not null default '',
  year               integer check (year is null or (year between 1900 and 2100)),
  publication_status text not null default 'published'
                       check (publication_status in ('published','preprint','under_review','blog','unknown')),
  paper_url          text not null default '',
  project_url        text not null default '',
  code_url           text not null default '',
  tags               text[] not null default '{}',
  summary_md         text not null default '',
  contributions_md   text not null default '',
  relevance_md       text not null default '',
  notes_md           text not null default '',
  reading_status     text not null default 'to_read'
                       check (reading_status in ('to_read','reading','reviewed','important')),
  team_prior_work    boolean not null default false,
  source_note        text not null default '',     -- where the metadata came from
  published          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index papers_year_idx on public.papers (year desc nulls last);
create index papers_status_idx on public.papers (reading_status);
create index papers_tags_idx on public.papers using gin (tags);

create table public.paper_category_links (
  paper_id      uuid not null references public.papers (id) on delete cascade,
  category_slug text not null references public.survey_categories (slug) on update cascade on delete cascade,
  primary key (paper_id, category_slug)
);
create index paper_category_links_cat_idx on public.paper_category_links (category_slug);

-- ---------------------------------------------------------------------
-- Milestones (proposal quarters are relative; dates optional)
-- ---------------------------------------------------------------------
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  phase       text not null default '',
  title       text not null,
  description_md text not null default '',
  evidence_md text not null default '',
  target_date date,
  status      text not null default 'planned' check (status in ('planned','active','done','deferred')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Polymorphic asset attachments (figures, demos, slides, ...)
-- ON DELETE RESTRICT: an asset that is attached anywhere cannot be deleted.
-- `group_key` groups attachments into a comparison (A/B audio,
-- side-by-side video, image compare).
-- ---------------------------------------------------------------------
create table public.content_asset_links (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.assets (id) on delete restrict,
  entity_type text not null check (entity_type in ('weekly_update','experiment','model_component','document','paper')),
  entity_id   uuid not null,
  role        text not null default 'figure'
                check (role in ('slides','figure','audio','video','comparison','diagram','attachment','data')),
  group_key   text not null default '',
  label       text not null default '',     -- e.g. "Ours", "Baseline (MMAudio)", "Ground truth"
  caption     text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index content_asset_links_entity_idx on public.content_asset_links (entity_type, entity_id, sort_order);
create index content_asset_links_asset_idx on public.content_asset_links (asset_id);

-- Remove attachment rows when their owning record is deleted.
create or replace function public.delete_entity_asset_links()
returns trigger
language plpgsql
as $$
begin
  delete from public.content_asset_links
   where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end;
$$;

create trigger weekly_updates_links_cleanup after delete on public.weekly_updates
  for each row execute function public.delete_entity_asset_links('weekly_update');
create trigger experiments_links_cleanup after delete on public.experiments
  for each row execute function public.delete_entity_asset_links('experiment');
create trigger model_components_links_cleanup after delete on public.model_components
  for each row execute function public.delete_entity_asset_links('model_component');
create trigger documents_links_cleanup after delete on public.documents
  for each row execute function public.delete_entity_asset_links('document');
create trigger papers_links_cleanup after delete on public.papers
  for each row execute function public.delete_entity_asset_links('paper');

-- updated_at triggers
create trigger site_settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
create trigger research_thrusts_touch before update on public.research_thrusts for each row execute function public.touch_updated_at();
create trigger assets_touch before update on public.assets for each row execute function public.touch_updated_at();
create trigger model_components_touch before update on public.model_components for each row execute function public.touch_updated_at();
create trigger experiments_touch before update on public.experiments for each row execute function public.touch_updated_at();
create trigger weekly_updates_touch before update on public.weekly_updates for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger papers_touch before update on public.papers for each row execute function public.touch_updated_at();
create trigger milestones_touch before update on public.milestones for each row execute function public.touch_updated_at();

-- Keep published_at in sync with the weekly status.
create or replace function public.weekly_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger weekly_updates_published_at before insert or update on public.weekly_updates
  for each row execute function public.weekly_published_at();

-- ---------------------------------------------------------------------
-- Asset usage lookup: explicit attachments + document files + inline
-- Markdown references (`asset:<uuid>`). Used before deleting/replacing.
-- SECURITY INVOKER: callers only see rows RLS already lets them see.
-- ---------------------------------------------------------------------
create or replace function public.asset_references(p_asset uuid)
returns table (entity_type text, entity_id uuid, title text, via text)
language sql
stable
as $$
  with needle as (select 'asset:' || p_asset::text as n)
  select l.entity_type, l.entity_id,
         coalesce(nullif(w.title, ''), 'Week of ' || w.week_start::text, e.code || ' — ' || e.name, m.title, d.title, p.title, ''),
         'attachment:' || l.role
    from public.content_asset_links l
    left join public.weekly_updates   w on l.entity_type = 'weekly_update'   and w.id = l.entity_id
    left join public.experiments      e on l.entity_type = 'experiment'      and e.id = l.entity_id
    left join public.model_components m on l.entity_type = 'model_component' and m.id = l.entity_id
    left join public.documents        d on l.entity_type = 'document'        and d.id = l.entity_id
    left join public.papers           p on l.entity_type = 'paper'           and p.id = l.entity_id
   where l.asset_id = p_asset
  union all
  select 'document', d.id, d.title, 'document file'
    from public.documents d where d.file_asset_id = p_asset or d.preview_asset_id = p_asset
  union all
  select 'document', d.id, d.title, 'document version'
    from public.document_versions v join public.documents d on d.id = v.document_id
   where v.file_asset_id = p_asset or v.preview_asset_id = p_asset
  union all
  select 'site_settings', null::uuid, 'Overview', 'architecture diagram'
    from public.site_settings s
   where s.architecture_asset_id = p_asset
      or concat_ws(' ', s.team_md, s.motivation_md, s.objectives_md, s.hypothesis_md, s.architecture_md) like '%' || (select n from needle) || '%'
  union all
  select 'weekly_update', w.id, coalesce(nullif(w.title, ''), 'Week of ' || w.week_start::text), 'inline markdown'
    from public.weekly_updates w
   where row_to_json(w)::text like '%' || (select n from needle) || '%'
  union all
  select 'experiment', e.id, e.code || ' — ' || e.name, 'inline markdown'
    from public.experiments e
   where row_to_json(e)::text like '%' || (select n from needle) || '%'
  union all
  select 'model_component', m.id, m.title, 'inline markdown'
    from public.model_components m
   where row_to_json(m)::text like '%' || (select n from needle) || '%'
  union all
  select 'document', d.id, d.title, 'inline markdown'
    from public.documents d
   where d.body_md like '%' || (select n from needle) || '%'
  union all
  select 'paper', p.id, p.title, 'inline markdown'
    from public.papers p
   where row_to_json(p)::text like '%' || (select n from needle) || '%'
  union all
  select 'research_thrust', t.id, t.title, 'inline markdown'
    from public.research_thrusts t
   where row_to_json(t)::text like '%' || (select n from needle) || '%';
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: administrator only
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'site_settings','research_thrusts','assets','asset_versions','model_components',
    'experiments','experiment_metrics','weekly_updates','weekly_update_experiments',
    'weekly_update_components','documents','document_versions','survey_categories',
    'papers','paper_category_links','milestones','content_asset_links'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t);
  end loop;
end;
$$;

-- app_admins: an admin may read the list (to confirm their own status);
-- nobody can write it through the API.
alter table public.app_admins enable row level security;
create policy app_admins_self_read on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- Privileges: the anonymous role gets nothing; RLS gates `authenticated`.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.app_admins from authenticated;
grant execute on function public.asset_references(uuid) to authenticated;

-- The single settings row.
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
