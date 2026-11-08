ALTER TABLE school_staff ADD COLUMN IF NOT EXISTS photo_key text;
ALTER TABLE school_students DROP CONSTRAINT IF EXISTS school_students_status_check;
ALTER TABLE school_students ADD CONSTRAINT school_students_status_check CHECK (status IN ('Active','Inactive','Completed','Suspended'));
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS platform_status text NOT NULL DEFAULT 'active' CHECK (platform_status IN ('active','suspended'));
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS billing_plan text NOT NULL DEFAULT 'Starter';
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','termly','annual'));
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS school_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  plan text NOT NULL,
  cycle text NOT NULL,
  student_count integer NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  last_reminder_at timestamptz
);
ALTER TABLE school_billing_invoices ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;
CREATE INDEX IF NOT EXISTS school_billing_invoices_school_idx ON school_billing_invoices(school_owner_id,issued_at DESC);
CREATE TABLE IF NOT EXISTS school_billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES school_billing_invoices(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'Manual',
  reference text NOT NULL DEFAULT '',
  paid_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  verified_by text NOT NULL DEFAULT '',
  verified_at timestamptz
);
ALTER TABLE school_billing_payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE school_billing_payments ADD COLUMN IF NOT EXISTS verified_by text NOT NULL DEFAULT '';
ALTER TABLE school_billing_payments ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE school_billing_payments DROP CONSTRAINT IF EXISTS school_billing_payments_status_check;
ALTER TABLE school_billing_payments ADD CONSTRAINT school_billing_payments_status_check CHECK (status IN ('pending','confirmed','rejected'));
CREATE UNIQUE INDEX IF NOT EXISTS school_billing_payments_one_pending_per_invoice_idx ON school_billing_payments(invoice_id) WHERE status='pending';
