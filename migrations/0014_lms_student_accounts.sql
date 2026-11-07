CREATE TABLE IF NOT EXISTS school_lms_student_accounts (
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  student_id uuid PRIMARY KEY REFERENCES school_students(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  session_hash text,
  session_expires_at timestamptz,
  last_login_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, student_id)
);
CREATE INDEX IF NOT EXISTS school_lms_student_sessions_idx ON school_lms_student_accounts (session_hash) WHERE session_hash IS NOT NULL;
