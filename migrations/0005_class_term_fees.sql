ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS term1_fee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS term2_fee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS term3_fee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS stream_fees jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE school_classes SET term1_fee=term_fee, term2_fee=term_fee, term3_fee=term_fee WHERE term_fee<>0 AND term1_fee=0 AND term2_fee=0 AND term3_fee=0;
