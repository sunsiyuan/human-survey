-- Schema invariant smoke test. Runs inside a transaction and rolls back at the end,
-- so it is safe against any database including production.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/schema-smoke.sql
--
-- This exists because the invariants it checks are the ones that fail silently: an
-- immutable table that quietly accepts an UPDATE, a completion sequence stamped
-- outside its lock, an answers row whose shape nothing rejects. None would surface as
-- an error at runtime — they would surface weeks later as a rollup that is subtly
-- wrong, which is the failure mode this product least survives.
--
-- Each check runs inside a DO block so that a caught exception rolls back only that
-- block's subtransaction and the run can continue.

\set ON_ERROR_STOP on
BEGIN;

\echo ''
\echo '--- setup ---'
INSERT INTO accounts (id, email) VALUES ('acc_test', 'smoke@example.com');
INSERT INTO api_keys (id, account_id, key_hash) VALUES ('key_test', 'acc_test', 'hash_test');
INSERT INTO attribution_forms (id, account_id, name) VALUES ('form_test', 'acc_test', 'smoke');
INSERT INTO attribution_configs (form_id, version, nodes, root_node_id, config_hash)
VALUES ('form_test', 1, '[{"id":"channel"}]'::jsonb, 'channel', 'hash_v1');
UPDATE attribution_forms SET current_version = 1 WHERE id = 'form_test';
\echo 'ok   form + config v1, pointer set'

\echo ''
\echo '--- 1. config snapshots are immutable ---'
DO $$
BEGIN
  UPDATE attribution_configs SET root_node_id = 'tampered'
   WHERE form_id = 'form_test' AND version = 1;
  RAISE WARNING 'FAIL an UPDATE on attribution_configs was allowed';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'ok   UPDATE rejected: %', left(SQLERRM, 60);
END $$;

\echo ''
\echo '--- 2. identical config dedupes on content hash ---'
DO $$
BEGIN
  INSERT INTO attribution_configs (form_id, version, nodes, root_node_id, config_hash)
  VALUES ('form_test', 2, '[{"id":"channel"}]'::jsonb, 'channel', 'hash_v1');
  RAISE WARNING 'FAIL duplicate config_hash was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'ok   duplicate config_hash rejected';
END $$;

\echo ''
\echo '--- 3. a form cannot point at a config version that does not exist ---'
DO $$
BEGIN
  UPDATE attribution_forms SET current_version = 99 WHERE id = 'form_test';
  -- The FK is DEFERRABLE INITIALLY DEFERRED so it would otherwise fire at commit.
  SET CONSTRAINTS attribution_forms_current_version_fk IMMEDIATE;
  RAISE WARNING 'FAIL dangling current_version was accepted';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'ok   dangling current_version rejected';
END $$;

\echo ''
\echo '--- 4. completion stamps seq + count; an open response stays invisible ---'
INSERT INTO attribution_responses (id, form_id, config_version, render_id, patch_token_hash, awaiting_node_id)
VALUES ('resp_open', 'form_test', 1, 'rnd_1', 'tok_1', 'creator');

DO $$
DECLARE open_visible INT; counted INT;
BEGIN
  SELECT count(*) INTO open_visible
    FROM attribution_responses
   WHERE form_id = 'form_test' AND completed_seq IS NOT NULL;
  SELECT response_count INTO counted FROM attribution_forms WHERE id = 'form_test';

  IF open_visible = 0 AND counted = 0 THEN
    RAISE NOTICE 'ok   open response is not in the cursor stream and is not counted';
  ELSE
    RAISE WARNING 'FAIL open response leaked (visible=%, counted=%)', open_visible, counted;
  END IF;
END $$;

UPDATE attribution_responses
   SET completed_at = now(), completion = 'finished', awaiting_node_id = NULL
 WHERE id = 'resp_open';

DO $$
DECLARE s BIGINT; counted INT;
BEGIN
  SELECT completed_seq INTO s FROM attribution_responses WHERE id = 'resp_open';
  SELECT response_count INTO counted FROM attribution_forms WHERE id = 'form_test';

  IF s IS NOT NULL AND counted = 1 THEN
    RAISE NOTICE 'ok   completion stamped completed_seq=% and incremented the count', s;
  ELSE
    RAISE WARNING 'FAIL completion did not stamp (seq=%, count=%)', s, counted;
  END IF;
END $$;

\echo ''
\echo '--- 5. completion columns are all-or-nothing ---'
DO $$
BEGIN
  INSERT INTO attribution_responses (id, form_id, config_version, render_id, patch_token_hash, completed_at)
  VALUES ('resp_bad', 'form_test', 1, 'rnd_x', 'tok_x', now());
  RAISE WARNING 'FAIL a half-stamped completion was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ok   half-stamped completion rejected';
END $$;

\echo ''
\echo '--- 6. answer shape: candidate_id and raw are mutually exclusive ---'
DO $$
BEGIN
  INSERT INTO attribution_answers (response_id, node_id, kind, candidate_id, raw)
  VALUES ('resp_open', 'channel', 'candidate', 'tiktok', 'also typed something');
  RAISE WARNING 'FAIL candidate + raw on the same answer was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ok   candidate + raw rejected';
END $$;

DO $$
BEGIN
  INSERT INTO attribution_answers (response_id, node_id, kind)
  VALUES ('resp_open', 'channel', 'raw');
  RAISE WARNING 'FAIL kind=raw with no text was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ok   kind=raw with no text rejected';
END $$;

\echo ''
\echo '--- 7. raw is stored verbatim; raw_normalized is derived ---'
INSERT INTO attribution_answers (response_id, node_id, kind, raw, position)
VALUES ('resp_open', 'creator', 'raw', '  An Asian Woman About Meetings  ', 3);

DO $$
DECLARE v TEXT; n TEXT;
BEGIN
  SELECT raw, raw_normalized INTO v, n
    FROM attribution_answers WHERE response_id = 'resp_open' AND node_id = 'creator';

  IF v = '  An Asian Woman About Meetings  ' AND n = 'an asian woman about meetings' THEN
    RAISE NOTICE 'ok   raw kept verbatim, normalized to "%"', n;
  ELSE
    RAISE WARNING 'FAIL raw=[%] normalized=[%]', v, n;
  END IF;
END $$;

\echo ''
\echo '--- 8. one live remap per (form, node, text); revoked ones do not block ---'
INSERT INTO attribution_remaps (id, form_id, node_id, raw_normalized, candidate_id)
VALUES ('rm_1', 'form_test', 'creator', 'an asian woman about meetings', 'jade');

DO $$
BEGIN
  INSERT INTO attribution_remaps (id, form_id, node_id, raw_normalized, candidate_id)
  VALUES ('rm_2', 'form_test', 'creator', 'an asian woman about meetings', 'nico');
  RAISE WARNING 'FAIL a second live remap of the same text was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'ok   second live remap rejected';
END $$;

UPDATE attribution_remaps SET revoked_at = now() WHERE id = 'rm_1';
INSERT INTO attribution_remaps (id, form_id, node_id, raw_normalized, candidate_id)
VALUES ('rm_2', 'form_test', 'creator', 'an asian woman about meetings', 'nico');
\echo 'ok   remap accepted after the previous one was revoked'

\echo ''
\echo '--- 9. events are idempotent when a key is supplied ---'
INSERT INTO attribution_events (id, form_id, external_id, event, value_cents, currency, occurred_at, idempotency_key)
VALUES ('ev_1', 'form_test', 'usr_8812', 'paid', 900, 'USD', now(), 'stripe_inv_1');

DO $$
BEGIN
  INSERT INTO attribution_events (id, form_id, external_id, event, occurred_at, idempotency_key)
  VALUES ('ev_2', 'form_test', 'usr_8812', 'paid', now(), 'stripe_inv_1');
  RAISE WARNING 'FAIL a replayed idempotency_key was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'ok   replayed idempotency_key rejected';
END $$;

DO $$
BEGIN
  INSERT INTO attribution_events (id, form_id, external_id, event, value_cents, occurred_at)
  VALUES ('ev_3', 'form_test', 'usr_1', 'paid', 900, now());
  RAISE WARNING 'FAIL value_cents without a currency was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ok   value_cents without a currency rejected';
END $$;

\echo ''
\echo '--- 10. deleting an account cascades everything ---'
DELETE FROM accounts WHERE id = 'acc_test';

DO $$
DECLARE leftover INT;
BEGIN
  SELECT (SELECT count(*) FROM attribution_forms WHERE account_id = 'acc_test')
       + (SELECT count(*) FROM attribution_responses WHERE form_id = 'form_test')
       + (SELECT count(*) FROM attribution_answers WHERE response_id = 'resp_open')
       + (SELECT count(*) FROM attribution_remaps WHERE form_id = 'form_test')
       + (SELECT count(*) FROM attribution_events WHERE form_id = 'form_test')
       + (SELECT count(*) FROM api_keys WHERE account_id = 'acc_test')
    INTO leftover;

  IF leftover = 0 THEN
    RAISE NOTICE 'ok   account delete cascaded to every child table';
  ELSE
    RAISE WARNING 'FAIL % rows survived the account delete', leftover;
  END IF;
END $$;

\echo ''
\echo 'done — rolling back'
ROLLBACK;
