#!/bin/bash
# HumanSurvey daily metrics snapshot
#
# Lives outside the app and outside any type checker, so a schema change breaks it
# silently — which is exactly what happened when the attribution pivot dropped the
# surveys and responses tables while these queries still named them. It runs daily from
# .github/workflows/metrics.yml, so "silently" meant one Telegram message a day that
# nobody read as an error.
# Usage: ./scripts/metrics.sh

DB_URL="${DATABASE_URL:-$(grep DATABASE_URL apps/web/.env.local 2>/dev/null | cut -d= -f2-)}"

echo "=== HumanSurvey Metrics ($(date +%Y-%m-%d)) ==="
echo ""

# npm downloads
echo "--- npm (last 7 days) ---"
curl -s "https://api.npmjs.org/downloads/point/last-week/humansurvey-mcp" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  Downloads: {d.get('downloads', 'N/A')}\")" \
  2>/dev/null || echo "  (unavailable)"
echo ""

# DB metrics
if [ -z "$DB_URL" ]; then
  echo "  (no DATABASE_URL found)"
  exit 0
fi

echo "--- Totals ---"
psql "$DB_URL" -t -c "
  SELECT 'Accounts:        ' || count(*) FROM accounts
  UNION ALL SELECT 'API keys (live): ' || count(*) FROM api_keys WHERE revoked_at IS NULL
  UNION ALL SELECT 'Forms (active):  ' || count(*) FROM attribution_forms WHERE status = 'active'
  UNION ALL SELECT 'Configured:      ' || count(*) FROM attribution_forms WHERE current_version IS NOT NULL
  UNION ALL SELECT 'Responses:       ' || count(*) FROM attribution_responses WHERE completed_seq IS NOT NULL
  UNION ALL SELECT 'In flight:       ' || count(*) FROM attribution_responses WHERE completed_seq IS NULL
  UNION ALL SELECT 'Conv. events:    ' || count(*) FROM attribution_events;
"

echo ""
echo "--- This week ---"
psql "$DB_URL" -t -c "
  SELECT 'New accounts:  ' || count(*) FROM accounts WHERE created_at > now() - interval '7 days'
  UNION ALL SELECT 'New forms:     ' || count(*) FROM attribution_forms WHERE created_at > now() - interval '7 days'
  UNION ALL SELECT 'New responses: ' || count(*) FROM attribution_responses WHERE completed_at > now() - interval '7 days'
  UNION ALL SELECT 'Reconfigures:  ' || count(*) FROM attribution_configs WHERE created_at > now() - interval '7 days';
"

echo ""
echo "--- Answer quality (the numbers that decide whether the product works) ---"
# Coverage is the metric the whole design hinges on: every value the rollup reports is
# multiplied by how often a respondent could actually find their answer. A rising
# unresolved share means the candidate lists are going stale, and it is the one signal
# that degrades silently — the percentages keep looking like percentages.
psql "$DB_URL" -t -c "
  SELECT
    'Resolved:      ' || count(*) FILTER (WHERE kind = 'candidate') ||
    '   free text: ' || count(*) FILTER (WHERE kind = 'raw') ||
    '   dont know: ' || count(*) FILTER (WHERE kind = 'dont_remember') ||
    '   skipped: '   || count(*) FILTER (WHERE kind = 'skipped')
  FROM attribution_answers;
"

echo ""
echo "--- Free text awaiting a remap (top 5) ---"
psql "$DB_URL" -t -c "
  SELECT a.raw_normalized, count(*) AS seen
  FROM attribution_answers a
  LEFT JOIN attribution_remaps m
    ON m.node_id = a.node_id
   AND m.raw_normalized = a.raw_normalized
   AND m.revoked_at IS NULL
  WHERE a.kind = 'raw' AND m.id IS NULL
  GROUP BY a.raw_normalized
  ORDER BY seen DESC, a.raw_normalized
  LIMIT 5;
"

echo ""
echo "--- MCP Registry ---"
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=human-survey" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); servers=r.get('servers',[]); print(f\"  Listed: {'yes' if servers else 'no'}\")" \
  2>/dev/null || echo "  (unavailable)"
