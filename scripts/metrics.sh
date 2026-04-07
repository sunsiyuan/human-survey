#!/bin/bash
# HumanSurvey daily metrics snapshot
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
  SELECT 'API keys:   ' || count(*) FROM api_keys
  UNION ALL SELECT 'Surveys:    ' || count(*) FROM surveys
  UNION ALL SELECT 'Responses:  ' || count(*) FROM responses;
"

echo ""
echo "--- This week ---"
psql "$DB_URL" -t -c "
  SELECT 'New keys:      ' || count(*) FROM api_keys WHERE created_at > now() - interval '7 days'
  UNION ALL SELECT 'New surveys:   ' || count(*) FROM surveys WHERE created_at > now() - interval '7 days'
  UNION ALL SELECT 'New responses: ' || count(*) FROM responses WHERE created_at > now() - interval '7 days';
"

echo ""
echo "--- Open surveys ---"
psql "$DB_URL" -t -c "
  SELECT id, title, response_count, created_at::date
  FROM surveys WHERE status = 'open'
  ORDER BY created_at DESC LIMIT 10;
"

echo ""
echo "--- MCP Registry ---"
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=human-survey" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); servers=r.get('servers',[]); print(f\"  Listed: {'yes' if servers else 'no'}\")" \
  2>/dev/null || echo "  (unavailable)"
