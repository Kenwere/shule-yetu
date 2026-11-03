CREATE TABLE IF NOT EXISTS school_staff (
  user_id text PRIMARY KEY,
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'Teacher',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, email)
);
CREATE INDEX IF NOT EXISTS school_staff_school_idx ON school_staff (school_owner_id);

CREATE TABLE IF NOT EXISTS school_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'Teacher',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, email)
);

CREATE TABLE IF NOT EXISTS school_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  streams jsonb NOT NULL DEFAULT '[]'::jsonb,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  term_fee numeric(12,2) NOT NULL DEFAULT 0,
  extra_fee numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, name)
);

CREATE TABLE IF NOT EXISTS school_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  admission_no text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text NOT NULL DEFAULT '',
  date_of_birth date,
  class_name text NOT NULL DEFAULT '',
  stream text NOT NULL DEFAULT '',
  guardian text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  admitted_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, admission_no)
);
CREATE INDEX IF NOT EXISTS school_students_school_name_idx ON school_students (school_owner_id, last_name, first_name);

CREATE TABLE IF NOT EXISTS school_fee_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  term text NOT NULL DEFAULT '',
  entry_type text NOT NULL CHECK (entry_type IN ('Fee obligation','Payment','Debt added','Credit added','Balance set')),
  debit numeric(12,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  method text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_fee_entries_student_date_idx ON school_fee_entries (student_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS school_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS school_announcements_school_expiry_idx ON school_announcements (school_owner_id, expires_at);

CREATE TABLE IF NOT EXISTS school_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('Present','Absent','Late')),
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS school_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  class_name text NOT NULL DEFAULT '',
  stream text NOT NULL DEFAULT '',
  term text NOT NULL DEFAULT '',
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS school_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES school_exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  subject text NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Denied')),
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id, subject)
);