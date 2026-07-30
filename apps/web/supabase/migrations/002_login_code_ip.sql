-- Per-IP throttling for login code issuance.
--
-- 001 rate-limited issuance per email address only, which stops one address being
-- spammed and does nothing about the shape that actually matters: POST /api/auth/code
-- is public, sends mail from our verified domain, and lets the caller name the
-- recipient. Twenty thousand harvested addresses at five each is a hundred thousand
-- HumanSurvey-branded emails in an hour, every one of them a deliverability complaint
-- against a domain whose only job is to land six-digit codes in inboxes.
--
-- The counter lives on login_codes rather than in a rate-limit table because the rows
-- are already there, already have created_at, and already expire.

ALTER TABLE login_codes ADD COLUMN ip TEXT;

CREATE INDEX idx_login_codes_ip
  ON login_codes (ip, created_at DESC)
  WHERE ip IS NOT NULL;
