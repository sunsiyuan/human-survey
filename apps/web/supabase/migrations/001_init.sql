-- HumanSurvey schema v2 — attribution.
--
-- Written fresh for the HDYHAU attribution pivot rather than migrated from the
-- pre-pivot schema, because there was no data worth carrying. Design contract:
-- docs/design/attribution-pivot.md. Section references below (§n) point at it.
--
-- Three things here are load-bearing and easy to mistake for bookkeeping. Each is
-- explained where it appears; in short:
--   1. attribution_configs rows are IMMUTABLE. Nothing may ever UPDATE them.
--   2. attribution_forms.response_count exists for its row lock, not its value.
--   3. attribution_answers.raw is verbatim and is never normalized on write.

-- ============================================================================
-- Accounts and credentials
-- ============================================================================

-- The pre-pivot model had no owner layer: the API key WAS the identity, and
-- surveys.api_key_id was the ownership record. Losing a key meant losing the data
-- with no recovery path, and rotating one meant losing access to everything the old
-- key had created (a documented wart, issue #7).
--
-- That was survivable when a survey was a two-week artifact. It is not survivable
-- for attribution, where the form is embedded in a customer's payment flow for
-- months, the candidate list is maintained on a monthly cadence (§10), and the
-- agent session that reads the rollup is never the session that created the key.
--
-- So: accounts own data, keys are credentials that point at an account. Rotation
-- is now free, and recovery goes through the email on the account.

CREATE TABLE accounts (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness without depending on the citext extension being
-- available on the target Postgres. Every lookup must use lower(email) to hit it.
CREATE UNIQUE INDEX idx_accounts_email ON accounts (lower(email));

CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key_hash     TEXT UNIQUE NOT NULL,
  name         TEXT,
  agent_client TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_account ON api_keys(account_id) WHERE revoked_at IS NULL;

-- Six-digit email codes. One mechanism serves both sign-ins: the browser exchanges a
-- verified code for a session, and the MCP server exchanges one for an API key, which
-- it writes straight to its local config. That second path is the point — the key
-- never passes through an agent transcript, which is what made keys get lost.
--
-- A code is looked up BY EMAIL, not by code: six digits is a 10^6 space that collides
-- across users constantly, so the code can never be a key. Consumed rows are kept,
-- not deleted, so a replay is distinguishable from an unknown code.
--
-- `attempts` is the only thing standing between a six-digit code and a trivial brute
-- force. Verification must increment it on every failure and refuse the row past a
-- small ceiling — a short expiry alone is not enough, since 10^6 guesses against an
-- unthrottled endpoint finish well inside any usable window. Issuance is separately
-- rate-limited per email.
--
-- code_hash is HMAC(email || code) under a server secret rather than a bare digest:
-- a plain SHA-256 of six digits is a rainbow table someone can build in a second.
CREATE TABLE login_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification looks up the newest live code for an address.
CREATE INDEX idx_login_codes_lookup
  ON login_codes (lower(email), created_at DESC)
  WHERE consumed_at IS NULL;

CREATE INDEX idx_login_codes_expiry ON login_codes(expires_at);

-- Browser sessions for the account area (keys, billing). Deliberately NOT a way to
-- reach form config or results — those stay API/MCP only (§11.1).
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_account ON sessions(account_id);

-- There is deliberately no device-code table. An OAuth-style device flow was the
-- obvious way to get a key onto the MCP server's disk without putting it in a
-- transcript, but the email code above already does that with no browser round trip
-- at all: the agent asks for an email, the human reads six digits out of their inbox
-- and says them, and the MCP server exchanges them for a key it writes to disk. One
-- mechanism, one table, and a flow that never leaves the conversation.

-- ============================================================================
-- Forms
-- ============================================================================

-- One attribution form = one placement. A customer typically has two (§3.7 as
-- amended): one in the payment/upgrade flow, where the response is joined to revenue
-- for free, and one in the signup flow, which is the only way to see the people a
-- channel sends who never pay. Comparing the same channel's share across the two
-- populations gives its signup-to-paid conversion rate.

CREATE TABLE attribution_forms (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  current_version INT,

  -- Which origins may embed this form. Pre-pivot this was deferred to "only after
  -- observed abuse". Under per-response pricing it is no longer an abuse question:
  -- an unlisted origin embedding your form spends your quota. Empty array means
  -- "not yet configured" and is enforced as allow-all, so a form is usable before
  -- the host knows its own origins; the configure path warns.
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',

  -- The bounded token set from §3.8 — accent, radius, font, dark mode. A fixed set
  -- of parameters, not a theme editor; the distinction is the whole reason §3.8 does
  -- not reopen a permanently-out-of-scope item.
  theme           JSONB NOT NULL DEFAULT '{}'::jsonb,

  per_response_webhook_url TEXT,

  -- See stamp_response_completion() below. This column exists for the row lock it
  -- forces, not for the number it holds. Do not "optimize" it away.
  response_count  INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT attribution_forms_status_check
    CHECK (status IN ('active', 'paused'))
);

CREATE INDEX idx_attribution_forms_account ON attribution_forms(account_id);

-- The pre-pivot schema pinned its status CHECK as an unnamed inline constraint, so
-- changing the allowed set later required looking up a generated name first. Every
-- CHECK in this file is named.

-- ============================================================================
-- Config snapshots — IMMUTABLE
-- ============================================================================

-- §5.3 carries `config_version` on every response and says it "scopes" the recorded
-- positions. This table is where a version's content lives, and the rule that makes
-- that scoping mean anything: **rows here are never updated**.
--
-- Why it has to be a snapshot rather than a counter on the form. §10 makes
-- reconfiguring a monthly habit — order tracks media spend, candidates track creator
-- partnerships. If only the current config existed, then dropping or renaming a
-- creator would silently rewrite what last quarter's rollup claimed was shown, and
-- the position-effect model would lose the definition of the option set it was fit
-- over. Snapshots cannot be backfilled: the information never existed.
--
-- Candidate label and icon_url are COPIED IN at configure time, with catalog_slug
-- kept only for provenance. Joining a live catalog at read time would mean a
-- product-side logo swap rewriting what an old rollup claims was rendered.

CREATE TABLE attribution_configs (
  form_id      TEXT NOT NULL REFERENCES attribution_forms(id) ON DELETE CASCADE,
  version      INT  NOT NULL,
  nodes        JSONB NOT NULL,
  root_node_id TEXT NOT NULL,

  -- Content hash over the canonicalized nodes. The UNIQUE index below makes an
  -- identical reconfigure return the existing version instead of minting a new one.
  --
  -- This is not cosmetic. Position-effect estimation is scoped to one config_version
  -- and returns null below a minimum impressions-per-position floor (§6.2), so an
  -- agent re-posting an unchanged config every month would fragment the sample and
  -- silently switch the correction off — a feature that stops working without ever
  -- erroring. The canonicalization rule (key order, whitespace) must stay stable
  -- across releases or this dedupe quietly stops matching; it lives in
  -- lib/attribution/hash.ts and is covered by a test.
  config_hash  TEXT NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (form_id, version)
);

CREATE UNIQUE INDEX idx_attribution_configs_hash
  ON attribution_configs (form_id, config_hash);

-- A form's current pointer must reference a version that actually exists. Enforcing
-- it here is what makes a partially-failed `configure` impossible to observe — and
-- is why lib/db.ts had to grow a transaction primitive before this table could be
-- correct (the pre-pivot codebase performed zero multi-statement transactions).
ALTER TABLE attribution_forms
  ADD CONSTRAINT attribution_forms_current_version_fk
  FOREIGN KEY (id, current_version)
  REFERENCES attribution_configs(form_id, version)
  DEFERRABLE INITIALLY DEFERRED;

-- Immutability is a rule the application cannot be trusted to remember, so it is
-- enforced here. Deletes are allowed only through the ON DELETE CASCADE from the
-- owning form.
CREATE OR REPLACE FUNCTION reject_config_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'attribution_configs rows are immutable (form % version %); mint a new version instead',
    OLD.form_id, OLD.version;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attribution_configs_immutable
BEFORE UPDATE ON attribution_configs
FOR EACH ROW EXECUTE FUNCTION reject_config_update();

-- ============================================================================
-- Responses
-- ============================================================================

-- Cursor reads are the primary read path for a perpetual stream (§11.2), and §5.4
-- makes a response mutable between its first POST and its follow-up PATCH. Those
-- two facts conflict under the pre-pivot design, where the cursor token was an
-- INSERT-order sequence on an insert-only table: an agent whose cursor had already
-- passed a row would receive the channel answer and never the creator answer —
-- precisely the half of the data this product exists to collect.
--
-- Resolved with a visibility gate rather than re-delivery. A response becomes
-- visible to cursor reads only when it is complete (or has been swept as abandoned),
-- and `completed_seq` — stamped at that moment, not at insert — is the cursor token.
-- Every row is therefore emitted exactly once and is final when emitted, so no
-- consumer has to upsert.

CREATE SEQUENCE attribution_responses_completed_seq;

CREATE TABLE attribution_responses (
  id             TEXT PRIMARY KEY,
  form_id        TEXT NOT NULL,
  config_version INT  NOT NULL,

  -- Client-minted, sent with the first POST. Two jobs. It is the seed for the
  -- `rotate` permutation (§6.1) — which cannot be the response id, because that is
  -- minted server-side inside the POST, i.e. after the first render has already
  -- happened. And it gives the recorded positions an audit trail: the same render_id
  -- must produce the same order, so a forged `positions` map is detectable.
  render_id      TEXT NOT NULL,

  -- One-time capability for the follow-up PATCH. The response endpoint is public and
  -- unauthenticated and hands the response id straight back to the browser, so a
  -- PATCH keyed on the id alone would let anyone holding an id overwrite someone
  -- else's answer. Hashed, like every other secret in this schema.
  patch_token_hash TEXT NOT NULL,

  -- Non-null means a follow-up node is still outstanding. This is also what makes
  -- §5.4's abandonment read-out well-defined by construction rather than a separate
  -- computation: a swept row keeps the node id it was waiting on.
  awaiting_node_id TEXT,

  -- The join key for conversion events (§9). Captured from day one even though the
  -- events endpoint lands later — §9's premise that the embed "already carries" this
  -- was wrong (it never existed), and a join key is not backfillable.
  --
  -- Deliberately NOT unique: a retake is allowed, and the rollup counts the first
  -- response per (form_id, external_id). Adding a UNIQUE constraint later is easy;
  -- dropping one that turned out to be wrong is not.
  external_id    TEXT,

  -- {node_id: {candidate_id: rendered_index}} for the INITIAL, UNFILTERED render of
  -- each node. Search-filtered picks are excluded — a respondent who types "jad" and
  -- picks the only match at index 0 books a position-0 impression that has nothing to
  -- do with the effect being modelled. Below-the-fold options ARE counted; treating
  -- "rendered" as "seen" is a known approximation, and the estimated weights ship
  -- with their sample size (§6.2) so a caller can judge it.
  --
  -- Stored verbatim rather than reconstructed from the seed, so that changing the
  -- permutation function later cannot invalidate history. Aggregated at read time
  -- with jsonb_each_text; if that ever gets slow, the escape hatch is a derived
  -- projection table, which can always be rebuilt from this column.
  positions      JSONB NOT NULL DEFAULT '{}'::jsonb,

  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,

  seq            BIGSERIAL,
  completed_seq  BIGINT UNIQUE,
  completed_at   TIMESTAMPTZ,
  completion     TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ON DELETE CASCADE is what completes the erasure path:
  --   accounts → attribution_forms → attribution_configs → attribution_responses
  --            → attribution_answers
  -- Without it this FK blocks the whole chain, and there is no other route from a
  -- form to its responses (form_id is only constrained transitively, through the
  -- config). A schema that stores respondent-authored descriptions of real people
  -- indefinitely, joined to a caller-supplied identifier and to money, has to be able
  -- to delete them; the pre-pivot schema could not, which is why key revocation had
  -- to be a soft delete. Config versions are never deleted on their own, so this rule
  -- only ever fires as part of that chain.
  FOREIGN KEY (form_id, config_version)
    REFERENCES attribution_configs(form_id, version) ON DELETE CASCADE,

  CONSTRAINT attribution_responses_completion_check
    CHECK (completion IS NULL OR completion IN ('finished', 'abandoned')),

  -- completed_at, completed_seq and completion are stamped together or not at all.
  CONSTRAINT attribution_responses_completion_consistent
    CHECK (num_nonnulls(completed_at, completed_seq, completion) IN (0, 3))
);

CREATE INDEX idx_attribution_responses_cursor
  ON attribution_responses(form_id, completed_seq)
  WHERE completed_seq IS NOT NULL;

CREATE INDEX idx_attribution_responses_external
  ON attribution_responses(form_id, external_id)
  WHERE external_id IS NOT NULL;

-- Open responses awaiting a follow-up, for the abandonment sweep.
CREATE INDEX idx_attribution_responses_awaiting
  ON attribution_responses(form_id, created_at)
  WHERE awaiting_node_id IS NOT NULL AND completed_at IS NULL;

-- Commit order must match completed_seq order, or a cursor read can strand a row
-- behind the cursor forever.
--
-- Postgres allocates sequence values before commit, so two concurrent completions
-- can commit in the opposite order from their allocated values. The fix is to take a
-- row lock on the owning form BEFORE calling nextval, and hold it to commit: the
-- UPDATE of attribution_forms.response_count does exactly that. Transaction N holds
-- the form row until it commits, so transaction N+1 cannot reach nextval until N is
-- durable. Per-form serialization is sufficient because cursor reads are per-form.
--
-- The ordering of the two statements below is the entire guarantee. Lock, then
-- allocate. Reversing them silently reintroduces the bug, with no error and no
-- visible symptom until an agent notices a missing response weeks later.
--
-- This is why response_count is not optional bookkeeping. Its predecessor carried
-- the same load (see _archive/007_responses_seq.sql) and reads just as removable.
CREATE OR REPLACE FUNCTION stamp_response_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE attribution_forms
       SET response_count = response_count + 1
     WHERE id = NEW.form_id;

    NEW.completed_seq := nextval('attribution_responses_completed_seq');
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attribution_responses_stamp_completion
BEFORE UPDATE ON attribution_responses
FOR EACH ROW EXECUTE FUNCTION stamp_response_completion();

-- ============================================================================
-- Answers
-- ============================================================================

-- One row per (response, node). Normalized rather than a JSONB blob on the response
-- so the rollup can aggregate in SQL with a from/to window. The pre-pivot results
-- endpoint read every response row with no LIMIT and aggregated in JS, which a
-- perpetual stream makes untenable.

CREATE TABLE attribution_answers (
  response_id  TEXT NOT NULL REFERENCES attribution_responses(id) ON DELETE CASCADE,
  node_id      TEXT NOT NULL,

  -- 'dont_remember' and 'skipped' are their own kinds rather than reserved candidate
  -- ids, because candidate ids are caller-defined (§5.1) and a caller could define
  -- anything we tried to reserve.
  kind         TEXT NOT NULL,

  candidate_id TEXT,

  -- Verbatim, exactly as typed. Never normalized on write: §7's retroactive remap
  -- depends on the original text still being there, and the normalization rule is
  -- expected to change.
  raw          TEXT,

  -- Generated so the write path and the remap lookup share one definition that a
  -- single ALTER can redefine. Must stay IMMUTABLE-safe.
  raw_normalized TEXT GENERATED ALWAYS AS (lower(btrim(raw))) STORED,

  -- True when the pick came out of a filtered search result rather than the initial
  -- list. Excluded from position-effect impressions; see attribution_responses.positions.
  selected_via_search BOOLEAN NOT NULL DEFAULT false,

  -- Rendered index of the chosen candidate in the initial unfiltered list.
  position     INT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (response_id, node_id),

  CONSTRAINT attribution_answers_kind_check
    CHECK (kind IN ('candidate', 'raw', 'dont_remember', 'skipped')),

  -- candidate_id iff kind='candidate'; raw iff kind='raw'.
  CONSTRAINT attribution_answers_shape_check CHECK (
    (kind = 'candidate' AND candidate_id IS NOT NULL AND raw IS NULL)
    OR (kind = 'raw' AND raw IS NOT NULL AND candidate_id IS NULL)
    OR (kind IN ('dont_remember', 'skipped') AND candidate_id IS NULL AND raw IS NULL)
  )
);

CREATE INDEX idx_attribution_answers_candidate
  ON attribution_answers(node_id, candidate_id)
  WHERE kind = 'candidate';

CREATE INDEX idx_attribution_answers_raw
  ON attribution_answers(node_id, raw_normalized)
  WHERE kind = 'raw';

-- ============================================================================
-- Retroactive remapping
-- ============================================================================

-- When an agent recognizes that a batch of free-text answers were all the same
-- newly-signed creator, one mapping fixes every past rollup at once — because the
-- rollup is computed at read time against the CURRENT remap table (§7).
--
-- Scoped to a form: node ids and candidate ids are both caller-defined, so without
-- the form_id one customer's remap would resolve another's free text.
--
-- candidate_id is deliberately not a foreign key. The candidate may have been
-- dropped from the current config while history still needs the mapping.

CREATE TABLE attribution_remaps (
  id             TEXT PRIMARY KEY,
  form_id        TEXT NOT NULL REFERENCES attribution_forms(id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,
  raw_normalized TEXT NOT NULL,
  candidate_id   TEXT NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Revoked rather than deleted, so a bad remap is reversible without destroying the
  -- record that it was ever applied. Two live remaps of the same string would
  -- double-count in the read-time join, hence the partial unique index.
  revoked_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_attribution_remaps_live
  ON attribution_remaps(form_id, node_id, raw_normalized)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- Conversion events
-- ============================================================================

-- Caller-pushed (§9), not a Stripe/AppsFlyer integration. Direct integrations are
-- what make a tool hard to remove, but they are an unbounded maintenance surface;
-- the schema is shaped the way one would want so adding it later is additive.

CREATE TABLE attribution_events (
  id              TEXT PRIMARY KEY,
  form_id         TEXT NOT NULL REFERENCES attribution_forms(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,
  event           TEXT NOT NULL,
  value_cents     BIGINT,
  currency        TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT attribution_events_event_check
    CHECK (event IN ('signup', 'activated', 'paid', 'churned')),
  CONSTRAINT attribution_events_value_check
    CHECK (value_cents IS NULL OR currency IS NOT NULL)
);

CREATE INDEX idx_attribution_events_join
  ON attribution_events(form_id, external_id, occurred_at);

CREATE UNIQUE INDEX idx_attribution_events_idempotency
  ON attribution_events(form_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- Calibration anchors
-- ============================================================================

-- §8 computes recall[c] = self-reports naming channel c / conversions c's own
-- console reports, and uses it to correct the channels that have no ground truth.
--
-- This needs a PERIOD AGGREGATE, which §9's strictly per-respondent event shape
-- cannot carry — the design doc said to post anchor counts "alongside the conversion
-- events", which does not typecheck against its own schema. Hence a separate table.

CREATE TABLE attribution_anchors (
  form_id      TEXT NOT NULL REFERENCES attribution_forms(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  conversions  INT  NOT NULL,
  source       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (form_id, candidate_id, period_start, period_end),

  CONSTRAINT attribution_anchors_period_check CHECK (period_end >= period_start),
  CONSTRAINT attribution_anchors_conversions_check CHECK (conversions >= 0)
);
