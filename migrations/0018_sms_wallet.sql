CREATE TABLE IF NOT EXISTS school_sms_wallets (
  school_owner_id text PRIMARY KEY REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_sms_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_owner_id text NOT NULL REFERENCES school_profiles(user_id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase','send')),
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed')),
  phone_number text NOT NULL DEFAULT '',
  checkout_request_id text UNIQUE,
  mpesa_receipt text NOT NULL DEFAULT '',
  provider_reference text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS school_sms_transactions_school_idx
  ON school_sms_transactions(school_owner_id,created_at DESC);
