-- Soft-delete for API keys. Revocation can't hard-DELETE the api_keys row:
-- surveys.api_key_id has a foreign key to api_keys(id) with no ON DELETE rule,
-- so deleting a key that ever created a survey fails the constraint. Instead,
-- DELETE /api/keys/{id} stamps revoked_at, and requireAuth rejects any key with
-- a non-null revoked_at. Survey ownership records stay intact.
ALTER TABLE api_keys ADD COLUMN revoked_at TIMESTAMPTZ;
