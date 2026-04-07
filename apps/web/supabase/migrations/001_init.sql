-- HumanSurvey schema v1
-- Consolidated from all incremental migrations.
-- Historical debt removed:
--   - No result_id column (was deprecated before first production use)
--   - No supabase_realtime publication (Neon does not use this)
--   - api_keys and lifecycle fields included from the start

CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  key_hash     TEXT UNIQUE NOT NULL,
  name         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE surveys (
  id             TEXT PRIMARY KEY,
  api_key_id     TEXT REFERENCES api_keys(id),
  title          TEXT NOT NULL,
  description    TEXT,
  schema         JSONB NOT NULL,
  markdown       TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'closed')),
  max_responses  INT,
  expires_at     TIMESTAMPTZ,
  response_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE responses (
  id         TEXT PRIMARY KEY,
  survey_id  TEXT NOT NULL REFERENCES surveys(id),
  answers    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_responses_survey ON responses(survey_id);

CREATE OR REPLACE FUNCTION increment_response_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE surveys SET response_count = response_count + 1
  WHERE id = NEW.survey_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_response_insert
AFTER INSERT ON responses
FOR EACH ROW EXECUTE FUNCTION increment_response_count();
