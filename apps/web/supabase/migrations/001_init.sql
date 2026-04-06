CREATE TABLE surveys (
  id TEXT PRIMARY KEY,
  result_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL,
  markdown TEXT NOT NULL,
  response_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  answers JSONB NOT NULL,
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
