-- Minimal stand-in for the parts of a Supabase database that the
-- migrations depend on. Used ONLY by tests/db/run-db-tests.sh against a
-- throwaway local Postgres. Never run this against a real project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id    uuid primary key,
  email text unique
);

-- Same contract as Supabase: auth.uid() reads the JWT `sub` claim that
-- PostgREST places into request.jwt.claims.
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'sub', ''
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid,
  metadata  jsonb
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- Mimic Supabase's default privileges that would otherwise give anon
-- access to new public tables; the migration must revoke them.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
grant usage on schema public to anon, authenticated;
