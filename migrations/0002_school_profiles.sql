CREATE TABLE IF NOT EXISTS school_profiles (
  user_id text PRIMARY KEY,
  school_name text NOT NULL CHECK (char_length(school_name) BETWEEN 1 AND 160),
  school_type text NOT NULL DEFAULT 'Other' CHECK (char_length(school_type) <= 80),
  contact_email text NOT NULL DEFAULT '' CHECK (char_length(contact_email) <= 254),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 50),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 300),
  website text NOT NULL DEFAULT '' CHECK (char_length(website) <= 300),
  motto text NOT NULL DEFAULT '' CHECK (char_length(motto) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);