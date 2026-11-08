ALTER TABLE school_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Give existing schools a one-time 30-day trial when this billing model is introduced.
UPDATE school_profiles
SET trial_started_at = COALESCE(trial_started_at, now()),
    subscription_expires_at = COALESCE(subscription_expires_at, now() + interval '30 days')
WHERE trial_started_at IS NULL OR subscription_expires_at IS NULL;

ALTER TABLE school_billing_payments
  ADD COLUMN IF NOT EXISTS mpesa_receipt text NOT NULL DEFAULT '';
ALTER TABLE school_billing_payments ALTER COLUMN paid_at DROP NOT NULL;
UPDATE school_billing_payments SET paid_at=NULL WHERE status='pending';

CREATE INDEX IF NOT EXISTS school_billing_payments_pending_reference_idx
  ON school_billing_payments(reference) WHERE status='pending';
