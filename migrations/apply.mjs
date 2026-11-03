import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED is required for migrations.");
const sql = await readFile(new URL("./0001_school_notes.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString, max: 1 });
try {
  await pool.query(sql);
  console.log("Applied migration 0001_school_notes.sql");
} finally {
  await pool.end();
}