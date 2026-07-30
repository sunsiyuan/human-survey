-- Per-response metadata captured from custom (non-reserved) URL query params on
-- the survey page, e.g. /s/abc123?embed=1&source=pricing&tier=lite. Lets hosts
-- segment responses by where they came from, readable later via GET .../responses
-- (the raw[] entries) and get_results.
--
-- Reserved params the survey page consumes for its own behavior (embed) are never
-- stored here. The POST .../responses endpoint is public and unauthenticated, so
-- the metadata is sanitized server-side on insert (string keys/values only, capped
-- key count and string lengths) — see lib/metadata.ts.
ALTER TABLE responses ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
