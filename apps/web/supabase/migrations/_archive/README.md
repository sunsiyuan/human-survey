# Archived migrations (pre-pivot)

These nine migrations built the general-survey product that HumanSurvey was before the
attribution pivot (`docs/design/attribution-pivot.md`, 2026-07-30).

They are **not applied** by the migration runner — it only reads `*.sql` in the parent
directory. They are kept because they are the only written record of why several
invariants exist, and two of them are still worth reading:

- `007_responses_seq.sql` — the argument for why a per-row sequence is not enough on its
  own, and why the response-count trigger's row lock is load-bearing for cursor
  correctness. `001_init.sql` in the parent directory carries that reasoning forward to
  the completion-stamping trigger.
- `009_api_key_revocation.sql` — why key revocation had to be a soft delete (no
  `ON DELETE` rule on the owning FK). The new schema sets `ON DELETE CASCADE`
  everywhere for exactly this reason.

The database they described was reset on 2026-07-30. A `pg_dump` of its final state,
plus a CSV export of the 13 API keys and 8 responses it held, is in
`../human-survey-ops/pre-pivot-export-20260730/`.
