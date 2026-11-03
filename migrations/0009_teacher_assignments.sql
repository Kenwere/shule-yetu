CREATE TABLE IF NOT EXISTS school_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES school_staff(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  stream text NOT NULL,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_owner_id,user_id,class_id,stream)
);
CREATE INDEX IF NOT EXISTS school_teacher_assignments_teacher_idx
  ON school_teacher_assignments (school_owner_id,user_id);