#!/bin/bash
# One-off export before the attribution-pivot database reset.
#
# Produces everything needed to (a) email existing key holders and (b) decide
# whether the reset breaks anyone who is actively using the product.
#
# Usage:
#   DATABASE_URL=postgres://... ./scripts/export-users.sh [outdir]
#
# Default outdir: ./export-<date>

set -euo pipefail

DB_URL="${DATABASE_URL:-$(grep DATABASE_URL apps/web/.env.local 2>/dev/null | cut -d= -f2- || true)}"
OUT="${1:-export-$(date +%Y%m%d)}"

if [ -z "$DB_URL" ]; then
  echo "error: no DATABASE_URL (set the env var or put it in apps/web/.env.local)" >&2
  exit 1
fi

mkdir -p "$OUT"

# --- 1. Full logical backup, before anything else ---------------------------
# Cheap insurance. The reset is irreversible; this is the only way back.
echo "==> pg_dump → $OUT/backup.sql"
pg_dump "$DB_URL" --no-owner --no-privileges > "$OUT/backup.sql"

# --- 2. Contactable users, ranked by how much they actually used it ---------
# Sorted so the first rows are the people whose migration email matters.
echo "==> contacts → $OUT/users.csv"
psql "$DB_URL" --csv -o "$OUT/users.csv" -c "
  SELECT
    k.email,
    k.name              AS key_name,
    k.agent_client,
    k.created_at::date  AS signed_up,
    k.last_used_at::date AS last_used,
    k.revoked_at IS NOT NULL AS revoked,
    count(DISTINCT s.id)          AS surveys,
    coalesce(sum(s.response_count), 0) AS responses
  FROM api_keys k
  LEFT JOIN surveys s ON s.api_key_id = k.id AND s.source = 'api'
  GROUP BY k.id, k.email, k.name, k.agent_client, k.created_at, k.last_used_at, k.revoked_at
  ORDER BY responses DESC, surveys DESC, k.created_at DESC;
"

# --- 3. Who would actually break -------------------------------------------
# Open surveys with responses are live integrations. If this is non-empty,
# the reset takes someone's running form down — decide deliberately.
echo "==> live surveys → $OUT/live-surveys.csv"
psql "$DB_URL" --csv -o "$OUT/live-surveys.csv" -c "
  SELECT
    s.id, s.title, s.status, s.response_count,
    s.created_at::date AS created,
    max(r.created_at)::date AS last_response,
    k.email AS owner_email
  FROM surveys s
  JOIN api_keys k ON k.id = s.api_key_id
  LEFT JOIN responses r ON r.survey_id = s.id
  WHERE s.source = 'api' AND s.status = 'open'
  GROUP BY s.id, s.title, s.status, s.response_count, s.created_at, k.email
  HAVING s.response_count > 0
  ORDER BY max(r.created_at) DESC NULLS LAST;
"

# --- 4. Raw responses, in case any of it is worth keeping -------------------
echo "==> responses → $OUT/responses.csv"
psql "$DB_URL" --csv -o "$OUT/responses.csv" -c "
  SELECT r.id, r.survey_id, s.title, r.answers, r.created_at
  FROM responses r
  JOIN surveys s ON s.id = r.survey_id
  WHERE s.source = 'api'
  ORDER BY r.created_at;
"

# --- 5. Summary to read before deciding -------------------------------------
echo ""
echo "=== Summary ==="
psql "$DB_URL" -t -c "
  SELECT 'keys total:         ' || count(*) FROM api_keys
  UNION ALL SELECT 'keys with email:    ' || count(*) FROM api_keys WHERE email IS NOT NULL AND email <> ''
  UNION ALL SELECT 'keys ever used:     ' || count(*) FROM api_keys WHERE last_used_at IS NOT NULL
  UNION ALL SELECT 'surveys (api):      ' || count(*) FROM surveys WHERE source = 'api'
  UNION ALL SELECT 'responses (api):    ' || count(*) FROM responses r JOIN surveys s ON s.id = r.survey_id WHERE s.source = 'api'
  UNION ALL SELECT 'OPEN w/ responses:  ' || count(*) FROM surveys WHERE source = 'api' AND status = 'open' AND response_count > 0;
"

echo ""
echo "Wrote: $OUT/{backup.sql,users.csv,live-surveys.csv,responses.csv}"
echo ""
echo "Read live-surveys.csv before dropping anything — every row there is a"
echo "form embedded in someone's page that the reset will take down."
