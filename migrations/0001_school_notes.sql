CREATE TABLE IF NOT EXISTS school_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  text text NOT NULL CHECK (char_length(text) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_notes_user_created_idx
  ON school_notes (user_id, created_at DESC);