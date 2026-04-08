ALTER TABLE api_keys
  ADD COLUMN email          TEXT,
  ADD COLUMN wallet_address TEXT,
  ADD COLUMN agent_client   TEXT;
