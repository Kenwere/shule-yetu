-- LMS data stays scoped to the existing school and student records.
CREATE TABLE IF NOT EXISTS school_lms_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id, class_id, subject, title)
);
CREATE INDEX IF NOT EXISTS school_lms_topics_class_idx ON school_lms_topics (school_owner_id, class_id, subject);

CREATE TABLE IF NOT EXISTS school_lms_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  stream text NOT NULL DEFAULT '*',
  topic_id uuid REFERENCES school_lms_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  material_type text NOT NULL CHECK (material_type IN ('note','file','video')),
  body text NOT NULL DEFAULT '',
  file_key text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  term text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published','scheduled')),
  publish_at timestamptz,
  created_by text NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_lms_materials_audience_idx ON school_lms_materials (school_owner_id, class_id, subject, publication_status, created_at DESC);

CREATE TABLE IF NOT EXISTS school_lms_progress (
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES school_lms_materials(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  seconds_viewed integer NOT NULL DEFAULT 0 CHECK (seconds_viewed >= 0),
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  PRIMARY KEY (student_id, material_id)
);
CREATE INDEX IF NOT EXISTS school_lms_progress_material_idx ON school_lms_progress (school_owner_id, material_id);

CREATE TABLE IF NOT EXISTS school_lms_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic_id uuid REFERENCES school_lms_topics(id) ON DELETE SET NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice','true_false','short_answer','fill_blank','matching','essay')),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key jsonb NOT NULL DEFAULT 'null'::jsonb,
  explanation text NOT NULL DEFAULT '',
  marks numeric(8,2) NOT NULL DEFAULT 1 CHECK (marks > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_lms_questions_scope_idx ON school_lms_question_bank (school_owner_id, class_id, subject, topic_id);

CREATE TABLE IF NOT EXISTS school_lms_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  stream text NOT NULL DEFAULT '*',
  topic_id uuid REFERENCES school_lms_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  term text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  attachment_key text NOT NULL DEFAULT '',
  due_at timestamptz,
  max_marks numeric(8,2) NOT NULL DEFAULT 100 CHECK (max_marks > 0),
  allow_late boolean NOT NULL DEFAULT false,
  allow_resubmit boolean NOT NULL DEFAULT true,
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published')),
  created_by text NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_lms_assignments_audience_idx ON school_lms_assignments (school_owner_id, class_id, publication_status, due_at);

CREATE TABLE IF NOT EXISTS school_lms_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES school_lms_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  file_key text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  response_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','returned','marked')),
  marks numeric(8,2),
  feedback text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  marked_by text,
  marked_at timestamptz,
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS school_lms_submissions_assignment_idx ON school_lms_submissions (school_owner_id, assignment_id, status);

CREATE TABLE IF NOT EXISTS school_lms_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  stream text NOT NULL DEFAULT '*',
  title text NOT NULL,
  body text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS school_lms_discussions_scope_idx ON school_lms_discussions (school_owner_id, class_id, subject, created_at DESC);
CREATE TABLE IF NOT EXISTS school_lms_discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES school_lms_discussions(id) ON DELETE CASCADE,
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_lms_replies_discussion_idx ON school_lms_discussion_replies (school_owner_id, discussion_id, created_at);
