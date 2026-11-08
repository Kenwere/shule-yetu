import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED is required for migrations.");
const migrations = [
  "0001_school_notes.sql",
  "0002_school_profiles.sql",
  "0003_school_portal.sql",
  "0004_school_events.sql",
  "0005_class_term_fees.sql",
  "0006_school_academic_terms.sql",
  "0007_fee_payment_idempotency.sql",
  "0008_attendance_excused.sql",
  "0009_teacher_assignments.sql",
  "0010_exam_academic_year.sql",
  "0011_student_photo.sql",
  "0012_school_logo.sql",
  "0013_lms_core.sql",
  "0014_lms_student_accounts.sql",
  "0015_lms_assessments.sql",
  "0016_lms_parent_access.sql",
  "0017_billing_and_profiles.sql",
  "0018_sms_wallet.sql",
  "0019_subscription_trials_stk.sql",
];
const pool = new Pool({ connectionString, max: 1 });
try {
  for (const migration of migrations) {
    const sql = await readFile(new URL(`./${migration}`, import.meta.url), "utf8");
    await pool.query(sql);
    console.log(`Applied migration ${migration}`);
  }
} finally {
  await pool.end();
}
