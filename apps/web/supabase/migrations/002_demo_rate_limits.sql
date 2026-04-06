CREATE TABLE demo_rate_limits (
  ip       TEXT PRIMARY KEY,
  count    INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);
