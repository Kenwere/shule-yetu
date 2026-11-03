import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED is required for migrations.");
const migrations = ["0001_school_notes.sql", "0002_school_profiles.sql", "0003_school_portal.sql", "0004_school_events.sql"];
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