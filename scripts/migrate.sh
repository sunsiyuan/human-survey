#!/bin/bash
# Apply pending SQL migrations, in order, exactly once each.
#
# Before this existed, migrations were pasted into a database console by hand and
# "which ones has production actually run" was reconstructed from a prose changelog
# in a separate private repo. For a pivot that resets the database and rebuilds the
# schema, that was the single riskiest operational fact about this project.
#
# Usage:
#   DATABASE_URL=postgres://... ./scripts/migrate.sh          # apply pending
#   DATABASE_URL=postgres://... ./scripts/migrate.sh --status # list, apply nothing
#   DATABASE_URL=postgres://... ./scripts/migrate.sh --dry-run
#
# 000_reset.sql is destructive and is skipped unless MIGRATE_ALLOW_RESET=1.
#
# psql rather than a Node runner on purpose: migrations contain dollar-quoted
# function bodies, and splitting those on ';' from application code is a bug waiting
# to happen. psql already parses them correctly.

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/web/supabase/migrations"
DB_URL="${DATABASE_URL:-$(grep DATABASE_URL apps/web/.env.local 2>/dev/null | cut -d= -f2- || true)}"

MODE="apply"
case "${1:-}" in
  --status)  MODE="status" ;;
  --dry-run) MODE="dry-run" ;;
  "")        ;;
  *) echo "unknown flag: $1" >&2; exit 2 ;;
esac

if [ -z "$DB_URL" ]; then
  echo "error: no DATABASE_URL (set the env var or put it in apps/web/.env.local)" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not on PATH (brew install libpq, then add its bin to PATH)" >&2
  exit 1
fi

run_sql() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q -t -A -c "$1"; }

# The ledger. Created before anything else so a fresh database bootstraps itself.
run_sql "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
" >/dev/null

applied_list=$(run_sql "SELECT filename || ' ' || checksum FROM schema_migrations;")

is_applied() { echo "$applied_list" | grep -q "^$1 "; }
applied_checksum() { echo "$applied_list" | grep "^$1 " | cut -d' ' -f2; }

pending=0
drifted=0

for path in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$path" ] || continue
  file="$(basename "$path")"
  checksum="$(shasum -a 256 "$path" | cut -d' ' -f1)"

  if is_applied "$file"; then
    if [ "$(applied_checksum "$file")" != "$checksum" ]; then
      # An applied migration whose file changed on disk. The database and the repo
      # now disagree about what was run, and no later migration can fix that.
      echo "DRIFT   $file — applied checksum does not match the file on disk"
      drifted=1
    else
      [ "$MODE" = "apply" ] || echo "ok      $file"
    fi
    continue
  fi

  if [ "$file" = "000_reset.sql" ] && [ "${MIGRATE_ALLOW_RESET:-}" != "1" ]; then
    echo "SKIP    $file — destructive; re-run with MIGRATE_ALLOW_RESET=1 to apply"
    continue
  fi

  pending=$((pending + 1))

  if [ "$MODE" != "apply" ]; then
    echo "pending $file"
    continue
  fi

  echo "apply   $file"
  # Single transaction per migration: either the whole file lands and is recorded,
  # or neither happens. --single-transaction plus the INSERT in the same psql
  # invocation is what makes the ledger honest.
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$path" \
    -c "INSERT INTO schema_migrations (filename, checksum) VALUES ('$file', '$checksum');"
done

if [ "$drifted" = "1" ]; then
  echo ""
  echo "One or more applied migrations were edited after the fact. Applied migrations" >&2
  echo "are immutable — write a new one instead of editing history." >&2
  exit 1
fi

if [ "$MODE" = "apply" ]; then
  if [ "$pending" = "0" ]; then
    echo "nothing to apply"
  else
    echo "applied $pending migration(s)"
  fi
fi
