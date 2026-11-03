CREATE TABLE IF NOT EXISTS school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_events_upcoming_idx ON school_events (school_owner_id, starts_at);
