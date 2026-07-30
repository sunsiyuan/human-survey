-- Adds a strictly monotonic per-row sequence to responses so cursor reads can't
-- silently miss rows that share a created_at microsecond with the cursor row.
-- nanoid ids are random; (created_at, id) ordering is not stable when two inserts
-- land in the same clock tick and the later one happens to be lexicographically
-- smaller. Sequences are unique, eliminating the tie.
--
-- Commit-order vs. allocation-order: Postgres sequences allocate before commit, so
-- in general two concurrent inserts can commit in opposite order from their seq
-- values. That would let `seq > cursor` strand an earlier-seq-but-later-committed
-- row behind the cursor. We rely on the AFTER INSERT trigger
-- `increment_response_count` taking a row lock on surveys.id (held until commit)
-- to serialize inserts *per survey*: tx N's seq is allocated before tx N+1's, and
-- tx N+1's trigger blocks until tx N commits, so per-survey commit order matches
-- per-survey seq order. Cursor reads are scoped per-survey, so this is sufficient.
-- If that trigger is ever removed, cursor logic must move to a watermark/snapshot
-- strategy.

ALTER TABLE responses ADD COLUMN seq BIGSERIAL;

-- Backfill: assign seq in (created_at, id) order so existing rows have a deterministic
-- ordering that matches the previous public ordering. BIGSERIAL would have populated
-- seq automatically, but the auto-assigned order on existing rows depends on physical
-- scan order, which is not necessarily creation order. Re-stamp explicitly.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM responses
)
UPDATE responses r
SET seq = ordered.rn
FROM ordered
WHERE r.id = ordered.id;

-- Advance the underlying sequence past the backfilled max so future inserts don't
-- collide with rewritten values.
SELECT setval(
  pg_get_serial_sequence('responses', 'seq'),
  COALESCE((SELECT MAX(seq) FROM responses), 0) + 1,
  false
);

ALTER TABLE responses ALTER COLUMN seq SET NOT NULL;
ALTER TABLE responses ADD CONSTRAINT responses_seq_unique UNIQUE (seq);

CREATE INDEX idx_responses_survey_seq ON responses(survey_id, seq DESC);
