import { Hono } from "hono";
import { cors } from "hono/cors";
import { attachDatabasePool } from "@neon/functions";
import { Pool } from "pg";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

type Env = { Variables: { userId: string } };
type SchoolNote = { id: string; user_id: string; text: string; created_at: string };

const databaseUrl = process.env.DATABASE_URL;
const authUrl = process.env.NEON_AUTH_BASE_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const realtimeSecret = process.env.NEON_REALTIME_SECRET;
if (!databaseUrl || !authUrl || !jwksUrl || !realtimeSecret) {
  throw new Error("Neon database, auth, and realtime environment variables are required.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
pool.on("error", (error) => console.error("Postgres pool error", error));
attachDatabasePool(pool);

const authOrigin = new URL(authUrl).origin;
const jwks = createRemoteJWKSet(new URL(jwksUrl));
const realtime = createRealtime({ secret: realtimeSecret, db: new URL(databaseUrl).pathname.slice(1) });
const s3 = new S3Client({ forcePathStyle: true });
const app = new Hono<Env>();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type", "X-File-Name"],
}));

app.get("/health", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({ status: "ok", postgres: "connected" });
  } catch (error) {
    console.error("Neon health check failed", error);
    return c.json({ status: "error", postgres: "unavailable" }, 503);
  }
});

async function requireUser(request: Request): Promise<string | null> {
  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: authOrigin, audience: authOrigin });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

app.use("/api/*", async (c, next) => {
  const userId = await requireUser(c.req.raw);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", userId);
  await next();
});

app.get("/api/notes", async (c) => {
  const result = await pool.query<SchoolNote>(
    "SELECT id, user_id, text, created_at FROM school_notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    [c.get("userId")],
  );
  return c.json(result.rows);
});

app.post("/api/notes", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Expected a JSON body." }, 400); }
  const text = typeof body === "object" && body !== null && "text" in body
    ? (body as { text?: unknown }).text
    : undefined;
  if (typeof text !== "string" || !text.trim() || text.length > 500) {
    return c.json({ error: "A note from 1 to 500 characters is required." }, 400);
  }
  const result = await pool.query<SchoolNote>(
    "INSERT INTO school_notes (user_id, text) VALUES ($1, $2) RETURNING id, user_id, text, created_at",
    [c.get("userId"), text.trim()],
  );
  return c.json(result.rows[0], 201);
});

app.post("/api/notes/live", async (c) => {
  const query = rawSql<SchoolNote>(
    "SELECT id, user_id, text, created_at FROM school_notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
    [c.get("userId")],
  );
  return c.json(await realtime.seal({ query }));
});

app.post("/api/files", async (c) => {
  const size = Number(c.req.header("Content-Length") || 0);
  if (size > 10 * 1024 * 1024) return c.json({ error: "Files must be 10 MB or smaller." }, 413);
  const rawName = c.req.header("X-File-Name") || "upload.bin";
  const filename = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "upload.bin";
  const key = c.get("userId") + "/" + randomUUID() + "-" + filename;
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength > 10 * 1024 * 1024) return c.json({ error: "Files must be 10 MB or smaller." }, 413);
  await s3.send(new PutObjectCommand({
    Bucket: "assets",
    Key: key,
    Body: bytes,
    ContentType: c.req.header("Content-Type") || "application/octet-stream",
  }));
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: "assets", Key: key }), { expiresIn: 600 });
  return c.json({ key, filename, url });
});

export default app;