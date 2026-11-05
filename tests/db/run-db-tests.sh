#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the Supabase stub plus every
# migration in supabase/migrations/, then runs tests/db/rls.test.mjs.
#
# Requirements: initdb / pg_ctl / psql on PATH (e.g. conda-forge `postgresql`).
# Usage: bash tests/db/run-db-tests.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/portal-db-test.XXXXXX")"
PORT="${PGTEST_PORT:-54329}"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() {
  pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
on_fail() { echo "--- postgres log ---"; cat "$WORK/pg.log" 2>/dev/null || true; }
trap 'on_fail' ERR

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$WORK/pg.log" -w start >/dev/null

apply_schema() {
  psql -q -v ON_ERROR_STOP=1 -d "$1" -f "$ROOT/tests/db/supabase_stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "[$1] applying $(basename "$f")"
    psql -q -v ON_ERROR_STOP=1 -d "$1" -f "$f"
  done
}

# 1) Authorization + integrity tests
apply_schema postgres
node "$ROOT/tests/db/rls.test.mjs"

# 2) Seed content validation on a fresh database (roles are cluster-wide,
#    so the second stub run must tolerate existing roles).
createdb seedcheck
sed -e 's/^create role \(.*\);$/do $$ begin create role \1; exception when duplicate_object then null; end $$;/' \
  "$ROOT/tests/db/supabase_stub.sql" > "$WORK/stub2.sql"
psql -q -v ON_ERROR_STOP=1 -d seedcheck -f "$WORK/stub2.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d seedcheck -f "$f"; done
(cd "$ROOT" && PGDATABASE=seedcheck node tests/db/seed.test.mjs)
