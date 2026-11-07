CREATE TABLE IF NOT EXISTS school_lms_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  stream text NOT NULL DEFAULT '*',
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
  attempts_allowed integer NOT NULL DEFAULT 1 CHECK (attempts_allowed BETWEEN 1 AND 10),
  results_released boolean NOT NULL DEFAULT false,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published')),
  created_by text NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS school_lms_assessments_scope_idx ON school_lms_assessments (school_owner_id,class_id,publication_status,starts_at);
CREATE TABLE IF NOT EXISTS school_lms_assessment_questions (
  assessment_id uuid NOT NULL REFERENCES school_lms_assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES school_lms_question_bank(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  PRIMARY KEY (assessment_id,question_id),
  UNIQUE (assessment_id,position)
);
CREATE TABLE IF NOT EXISTS school_lms_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES school_lms_assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','marked')),
  score numeric(8,2),
  marked_by text,
  marked_at timestamptz,
  UNIQUE (assessment_id,student_id,attempt_number)
);
CREATE INDEX IF NOT EXISTS school_lms_attempts_student_idx ON school_lms_attempts (school_owner_id,student_id,assessment_id);
CREATE TABLE IF NOT EXISTS school_lms_attempt_answers (
  attempt_id uuid NOT NULL REFERENCES school_lms_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES school_lms_question_bank(id) ON DELETE RESTRICT,
  answer jsonb NOT NULL DEFAULT 'null'::jsonb,
  marks_awarded numeric(8,2),
  feedback text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id,question_id)
);
