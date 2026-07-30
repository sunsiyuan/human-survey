-- One-time teardown of the pre-pivot database. Destructive by design.
--
-- Kept as a separate, explicitly named file rather than folded into 001 so that
-- `001_init.sql` stays safe to run against a fresh database (a preview branch, a
-- local Postgres, a future re-provision) without carrying a DROP with it.
--
-- Run this exactly once, against the production database, after taking a backup.
-- The migration runner will refuse to apply it unless MIGRATE_ALLOW_RESET=1 is set.
--
-- What was here: 13 API keys (11 ever used, 4 with an email — three of those the
-- owner's own, one an @example.com placeholder), 15 surveys, 8 responses. Every row
-- was a smoke test or the owner's own demo; there were no third-party users, which is
-- why this is a reset and not a migration. Backup and CSV export:
-- ../human-survey-ops/pre-pivot-export-20260730/
--
-- The old rows are structurally unconvertible in any case. Every stored survey schema
-- uses product-minted positional ids (`q_0`, `opt_0`) where the new schema requires
-- caller-defined stable ids, and no render order was ever recorded — so synthesizing
-- the `positions` map for a historical response would fabricate the sole input to the
-- position-effect model.

DROP TRIGGER IF EXISTS on_response_insert ON responses;
DROP FUNCTION IF EXISTS increment_response_count();

DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS surveys CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS demo_rate_limits CASCADE;
