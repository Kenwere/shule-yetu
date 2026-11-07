ALTER TABLE school_students ADD COLUMN IF NOT EXISTS guardian_email text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS school_lms_parent_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  session_hash text,
  session_expires_at timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id,email)
);
CREATE TABLE IF NOT EXISTS school_lms_parent_students (
  parent_id uuid NOT NULL REFERENCES school_lms_parent_accounts(id) ON DELETE CASCADE,
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id,student_id),
  UNIQUE (school_owner_id,student_id,parent_id)
);
CREATE INDEX IF NOT EXISTS school_lms_parent_sessions_idx ON school_lms_parent_accounts(session_hash) WHERE session_hash IS NOT NULL;
