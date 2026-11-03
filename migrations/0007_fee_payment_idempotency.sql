ALTER TABLE school_fee_entries ADD COLUMN IF NOT EXISTS request_key text;
CREATE UNIQUE INDEX IF NOT EXISTS school_fee_entries_request_key_idx
  ON school_fee_entries (school_owner_id, request_key)
  WHERE request_key IS NOT NULL;
