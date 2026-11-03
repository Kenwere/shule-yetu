ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS vision text NOT NULL DEFAULT '';
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '';
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS active_term text NOT NULL DEFAULT '';
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term1_start_date date;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term1_end_date date;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term2_start_date date;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term2_end_date date;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term3_start_date date;
ALTER TABLE school_profiles ADD COLUMN IF NOT EXISTS term3_end_date date;
