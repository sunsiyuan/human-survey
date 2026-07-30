-- Phase 2 + 3 of async results loop.
-- Phase 2 uses completion_webhook_fired_at; Phase 3 uses notify_at_responses + threshold_webhook_fired_at.
-- Migrations consolidated since the columns are conceptually one feature.

ALTER TABLE surveys ADD COLUMN completion_webhook_fired_at TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN threshold_webhook_fired_at  TIMESTAMPTZ;
ALTER TABLE surveys ADD COLUMN notify_at_responses         INTEGER;

-- Treat already-closed surveys as already-notified. The previous code path fired
-- the completion webhook on transition to 'closed', so any closed survey that had a
-- webhook_url has already received its delivery. This backfill prevents a
-- retroactive blast on the next interaction.
UPDATE surveys
SET completion_webhook_fired_at = COALESCE(created_at, now())
WHERE status = 'closed' AND completion_webhook_fired_at IS NULL;
