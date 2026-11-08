import type { Context as HonoContext, Hono } from "hono";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool } from "pg";
import { parseTriggerDelivery } from "@neon/functions/triggers";

type ApiEnv = { Variables: { userId: string; userEmail: string; userName: string } };
type SchoolContext = {
  schoolId: string;
  role: string;
  permissions: string[];
  name: string;
  studentId?: string;
  parentId?: string;
};
type Permission =
  | "view_students"
  | "edit_students"
  | "view_fees"
  | "edit_fees"
  | "manage_staff"
  | "view_classes"
  | "edit_classes"
  | "manage_settings"
  | "view_announcements"
  | "manage_announcements"
  | "view_attendance"
  | "edit_attendance"
  | "view_exams"
  | "edit_exams"
  | "view_lms"
  | "manage_lms";
const allPermissions: Permission[] = [
  "view_students",
  "edit_students",
  "view_fees",
  "edit_fees",
  "manage_staff",
  "view_classes",
  "edit_classes",
  "manage_settings",
  "view_announcements",
  "manage_announcements",
  "view_attendance",
  "edit_attendance",
  "view_exams",
  "edit_exams",
  "view_lms",
  "manage_lms",
];
const s3 = new S3Client({ forcePathStyle: true });
const imageBucket = "assets";
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
async function hashStudentPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function verifyStudentPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const rolePermissions: Record<string, Permission[]> = {
  Admin: allPermissions,
  Teacher: [
    "view_students",
    "view_classes",
    "view_announcements",
    "view_attendance",
    "edit_attendance",
    "view_exams",
    "edit_exams",
    "view_lms",
    "manage_lms",
  ],
  Accountant: ["view_students", "view_fees", "edit_fees", "view_classes", "view_announcements"],
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => entities[char] || char);
}
async function startDarajaStkPush(phone: string, amount: number, reference: string, description: string) {
  const required = [
    "DARAJA_CONSUMER_KEY",
    "DARAJA_CONSUMER_SECRET",
    "DARAJA_SHORTCODE",
    "DARAJA_PASSKEY",
    "DARAJA_CALLBACK_URL",
  ];
  if (required.some((key) => !process.env[key]))
    throw new Error("M-Pesa checkout is not configured for this app yet.");
  const production = process.env.DARAJA_ENVIRONMENT === "production";
  const apiHost = production ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const credentials = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`,
  ).toString("base64");
  const tokenResponse = await fetch(`${apiHost}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const tokenBody = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenResponse.ok || !tokenBody.access_token)
    throw new Error("Could not authenticate with M-Pesa Daraja.");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  const timestamp = `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
  const shortcode = process.env.DARAJA_SHORTCODE!;
  const password = Buffer.from(`${shortcode}${process.env.DARAJA_PASSKEY}${timestamp}`).toString("base64");
  const response = await fetch(`${apiHost}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: process.env.DARAJA_CALLBACK_URL,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: description.slice(0, 13),
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    errorMessage?: string; CustomerMessage?: string; CheckoutRequestID?: string;
    ResponseCode?: string; MerchantRequestID?: string;
  };
  if (!response.ok || result.ResponseCode !== "0" || !result.CheckoutRequestID)
    throw new Error(result.errorMessage || result.CustomerMessage || "M-Pesa STK Push failed.");
  return { checkoutRequestId: result.CheckoutRequestID, merchantRequestId: result.MerchantRequestID || "", message: result.CustomerMessage || "Approve the M-Pesa request on your phone." };
}

export function mountSchoolApi(app: Hono<ApiEnv>, pool: Pool) {
  async function contextFor(c: HonoContext<ApiEnv>): Promise<SchoolContext | null> {
    const userId = c.get("userId") as string;
    const staff = await pool.query(
      "SELECT school_owner_id, role, permissions, full_name FROM school_staff WHERE user_id = $1 AND active = true",
      [userId],
    );
    if (staff.rowCount) {
      const row = staff.rows[0];
      return {
        schoolId: row.school_owner_id,
        role: row.role,
        permissions: row.permissions ?? [],
        name: row.full_name,
      };
    }
    if (userId.startsWith("student:")) {
      const studentId = userId.slice("student:".length);
      const student = await pool.query(
        `SELECT s.school_owner_id,s.id,s.first_name,s.last_name
         FROM school_students s JOIN school_lms_student_accounts a ON a.student_id=s.id AND a.school_owner_id=s.school_owner_id
         WHERE s.id=$1 AND a.active AND s.status='Active'`,
        [studentId],
      );
      if (!student.rowCount) return null;
      return {
        schoolId: student.rows[0].school_owner_id,
        role: "Student",
        permissions: ["view_lms"],
        name: `${student.rows[0].first_name} ${student.rows[0].last_name}`.trim(),
        studentId: student.rows[0].id,
      };
    }
    if (userId.startsWith("parent:")) {
      const parentId = userId.slice("parent:".length);
      const parent = await pool.query(
        "SELECT school_owner_id,full_name FROM school_lms_parent_accounts WHERE id=$1 AND active AND session_expires_at>now()",
        [parentId],
      );
      if (!parent.rowCount) return null;
      return {
        schoolId: parent.rows[0].school_owner_id,
        role: "Parent",
        permissions: ["view_lms"],
        name: parent.rows[0].full_name || "Parent",
        parentId,
      };
    }
    const owned = await pool.query(
      "SELECT user_id, school_name FROM school_profiles WHERE user_id = $1",
      [userId],
    );
    if (!owned.rowCount) return null;
    await pool.query(
      "INSERT INTO school_staff (user_id, school_owner_id, email, full_name, role, permissions) VALUES ($1,$1,$2,$3,'Admin',$4::jsonb) ON CONFLICT (user_id) DO NOTHING",
      [
        userId,
        c.get("userEmail"),
        c.get("userName") || owned.rows[0].school_name,
        JSON.stringify(allPermissions),
      ],
    );
    return {
      schoolId: userId,
      role: "Admin",
      permissions: allPermissions,
      name: c.get("userName") || owned.rows[0].school_name,
    };
  }
  async function syncAutomaticTerm(schoolId: string) {
    const q = await pool.query(
      "SELECT academic_year,active_term,term1_start_date,term1_end_date,term2_start_date,term2_end_date,term3_start_date,term3_end_date FROM school_profiles WHERE user_id=$1",
      [schoolId],
    );
    if (!q.rowCount) return;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (k: string) => parts.find((p) => p.type === k)?.value || "";
    const today = part("year") + "-" + part("month") + "-" + part("day"),
      row = q.rows[0];
    let n = 0;
    for (const i of [1, 2, 3]) {
      const a = row["term" + i + "_start_date"],
        b = row["term" + i + "_end_date"];
      if (a && b && today >= String(a).slice(0, 10) && today <= String(b).slice(0, 10)) {
        n = i;
        break;
      }
    }
    if (!n || row.active_term === "Term " + n) return;
    const term = "Term " + n,
      year = String(row.academic_year || "");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT active_term FROM school_profiles WHERE user_id=$1 FOR UPDATE",
        [schoolId],
      );
      if (!locked.rowCount || locked.rows[0].active_term === term) {
        await client.query("COMMIT");
        return;
      }
      await client.query(
        "UPDATE school_profiles SET active_term=$2,updated_at=now() WHERE user_id=$1",
        [schoolId, term],
      );
      if (year) {
        const number = n,
          key = "term" + n + "Fee",
          current = term + " " + year;
        await client.query(
          "INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment) SELECT s.school_owner_id,s.id,$2,'Fee obligation',COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric,CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)+COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee),c.name||' term fees' FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees')",
          [schoolId, current, key, number],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async function guard(
    c: HonoContext<ApiEnv>,
    permission: Permission,
  ): Promise<SchoolContext | null> {
    const context = await contextFor(c);
    if (!context) {
      c.status(403);
      c.header("content-type", "application/json");
      return null;
    }
    if (context.role === "Parent" && !c.req.path.startsWith("/api/lms/parent/")) {
      c.status(403);
      c.header("content-type", "application/json");
      return null;
    }
    await syncAutomaticTerm(context.schoolId);
    if (
      !["/api/billing", "/api/billing/invoices"].includes(c.req.path) &&
      !c.req.path.startsWith("/api/billing/")
    ) {
      const subscription = await pool.query(
        "SELECT platform_status,subscription_expires_at FROM school_profiles WHERE user_id=$1",
        [context.schoolId],
      );
      const expiresAt = subscription.rows[0]?.subscription_expires_at;
      if (
        subscription.rows[0]?.platform_status === "suspended" ||
        (expiresAt && new Date(expiresAt) < new Date())
      ) {
        c.status(402);
        c.header("content-type", "application/json");
        return null;
      }
    }
    if (context.role !== "Admin" && !context.permissions.includes(permission)) {
      c.status(403);
      c.header("content-type", "application/json");
      return null;
    }
    return context;
  }

  app.post("/internal/sync-school-terms", async (c) => {
    const parsed = await parseTriggerDelivery(c.req.raw);
    if (parsed.ok === false)
      return c.json({ error: parsed.error }, parsed.error === "invalid_body" ? 400 : 401);
    if (parsed.invocation.type !== "schedule")
      return c.json({ error: "Schedule trigger required." }, 400);
    const schools = await pool.query("SELECT user_id FROM school_profiles");
    for (const school of schools.rows) await syncAutomaticTerm(school.user_id);
    return c.json({ schoolsChecked: schools.rowCount || 0 });
  });
  app.post("/internal/run-school-billing", async (c) => {
    const parsed = await parseTriggerDelivery(c.req.raw);
    if (parsed.ok === false)
      return c.json({ error: parsed.error }, parsed.error === "invalid_body" ? 400 : 401);
    if (parsed.invocation.type !== "schedule")
      return c.json({ error: "Schedule trigger required." }, 400);
    const schools =
      await pool.query(`SELECT p.user_id,p.school_name,p.contact_email,p.billing_plan,p.billing_cycle,p.subscription_expires_at,
      (SELECT count(*)::int FROM school_students s WHERE s.school_owner_id=p.user_id AND s.status='Active') AS students
      FROM school_profiles p WHERE p.platform_status='active'`);
    let created = 0,
      reminders = 0;
    for (const school of schools.rows) {
      const count = Number(school.students);
      const plan =
        count > 1000
          ? "Enterprise"
          : count > 600
            ? "Premium"
            : count > 300
              ? "Standard"
              : count > 100
                ? "Basic"
                : "Starter";
      const cycle = ["monthly", "termly", "annual"].includes(school.billing_cycle)
        ? school.billing_cycle
        : "monthly";
      const base = (
        { Starter: 1500, Basic: 3000, Standard: 5000, Premium: 8000 } as Record<string, number>
      )[plan];
      if (!base) continue;
      const pending = await pool.query(
        "SELECT 1 FROM school_billing_invoices WHERE school_owner_id=$1 AND status='due' LIMIT 1",
        [school.user_id],
      );
      const expires = school.subscription_expires_at
        ? new Date(school.subscription_expires_at)
        : null;
      if (!pending.rowCount && (!expires || expires.getTime() <= Date.now() + 7 * 86400000)) {
        const amount = base * (cycle === "termly" ? 3 : cycle === "annual" ? 10 : 1);
        const invoice = await pool.query(
          `INSERT INTO school_billing_invoices(school_owner_id,invoice_number,plan,cycle,student_count,amount,due_at)
          VALUES($1,'SY-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),$2,$3,$4,$5,COALESCE($6::timestamptz,now()+interval '7 days'))
          RETURNING invoice_number,due_at`,
          [school.user_id, plan, cycle, count, amount, school.subscription_expires_at],
        );
        await pool.query(
          "UPDATE school_profiles SET billing_plan=$2,billing_cycle=$3,subscription_expires_at=COALESCE(subscription_expires_at,now()+interval '30 days') WHERE user_id=$1",
          [school.user_id, plan, cycle],
        );
        created++;
        if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && school.contact_email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL,
              to: [school.contact_email],
              subject: `Shule Yetu subscription invoice ${invoice.rows[0].invoice_number}`,
              text: `Hello ${school.school_name}, your ${plan} ${cycle} subscription invoice is ready. Amount: KSh ${amount.toLocaleString()}. Due: ${new Date(invoice.rows[0].due_at).toLocaleDateString()}. Sign in to the Billing page and pay by M-Pesa STK Push. School access pauses when the subscription expires.`,
            }),
          }).catch(() => undefined);
        }
      }
      const dueSoon = await pool.query(
        "SELECT id,invoice_number,amount,due_at FROM school_billing_invoices WHERE school_owner_id=$1 AND status='due' AND due_at<=now()+interval '3 days' AND (last_reminder_at IS NULL OR last_reminder_at<now()-interval '24 hours')",
        [school.user_id],
      );
      for (const invoice of dueSoon.rows) {
        if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !school.contact_email)
          continue;
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL,
              to: [school.contact_email],
              subject: `Payment reminder: Shule Yetu invoice ${invoice.invoice_number}`,
              text: `Hello ${school.school_name}, invoice ${invoice.invoice_number} for KSh ${Number(invoice.amount).toLocaleString()} is due ${new Date(invoice.due_at).toLocaleDateString()}. Pay by M-Pesa STK Push in the Billing page to keep school access active.`,
            }),
          });
          if (response.ok) {
            await pool.query(
              "UPDATE school_billing_invoices SET last_reminder_at=now() WHERE id=$1",
              [invoice.id],
            );
            reminders++;
          }
        } catch {
          /* Email reminders are optional until Resend is configured. */
        }
      }
    }
    return c.json({
      schoolsChecked: schools.rowCount || 0,
      invoicesCreated: created,
      remindersSent: reminders,
    });
  });
  app.get("/api/me", async (c) => {
    const context = await contextFor(c);
    if (!context) return c.json({ error: "This account is not attached to a school." }, 403);
    const profile = await pool.query(
      `SELECT school_name, school_type, contact_email, phone, address, website, motto, vision, logo_key, academic_year AS "academicYear", active_term AS "activeTerm", to_char(term1_start_date,'YYYY-MM-DD') AS "term1StartDate", to_char(term1_end_date,'YYYY-MM-DD') AS "term1EndDate", to_char(term2_start_date,'YYYY-MM-DD') AS "term2StartDate", to_char(term2_end_date,'YYYY-MM-DD') AS "term2EndDate", to_char(term3_start_date,'YYYY-MM-DD') AS "term3StartDate", to_char(term3_end_date,'YYYY-MM-DD') AS "term3EndDate" FROM school_profiles WHERE user_id = $1`,
      [context.schoolId],
    );
    const school = profile.rows[0] ?? null;
    if (school?.logo_key) {
      school.logoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: imageBucket, Key: school.logo_key }),
        { expiresIn: 3600 },
      );
      delete school.logo_key;
    }
    const account = await pool.query("SELECT photo_key FROM school_staff WHERE user_id=$1", [
      c.get("userId"),
    ]);
    const avatarUrl = account.rows[0]?.photo_key
      ? await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: imageBucket, Key: account.rows[0].photo_key }),
          { expiresIn: 3600 },
        )
      : "";
    return c.json({
      userId: c.get("userId"),
      email: c.get("userEmail"),
      name: context.name,
      role: context.role,
      permissions: context.permissions,
      avatarUrl,
      school,
    });
  });
  app.post("/api/me/photo", async (c) => {
    const context = await contextFor(c);
    if (!context || context.role === "Student" || context.role === "Parent")
      return c.json({ error: "Not allowed to update this profile." }, 403);
    const type =
      String(c.req.header("Content-Type") || "")
        .split(";")[0]
        ?.toLowerCase() || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type))
      return c.json({ error: "Use a JPG, PNG, or WEBP image." }, 415);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length || bytes.byteLength > 5 * 1024 * 1024)
      return c.json({ error: "Choose an image no larger than 5 MB." }, 413);
    const key = `profiles/${context.schoolId}/${c.get("userId")}/${randomUUID()}.${type === "image/jpeg" ? "jpg" : type.slice(6)}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: imageBucket,
        Key: key,
        Body: bytes,
        ContentType: type,
        CacheControl: "private, max-age=300",
      }),
    );
    const old = await pool.query("SELECT photo_key FROM school_staff WHERE user_id=$1", [
      c.get("userId"),
    ]);
    await pool.query("UPDATE school_staff SET photo_key=$2 WHERE user_id=$1", [
      c.get("userId"),
      key,
    ]);
    if (old.rows[0]?.photo_key)
      await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: old.rows[0].photo_key }));
    const avatarUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: imageBucket, Key: key }),
      { expiresIn: 3600 },
    );
    return c.json({ avatarUrl });
  });

  app.get("/api/school-profile", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to view school settings." }, 403);
    const result = await pool.query(
      `SELECT school_name, school_type, contact_email, phone, address, website, motto, vision, logo_key, academic_year AS "academicYear", active_term AS "activeTerm", to_char(term1_start_date,'YYYY-MM-DD') AS "term1StartDate", to_char(term1_end_date,'YYYY-MM-DD') AS "term1EndDate", to_char(term2_start_date,'YYYY-MM-DD') AS "term2StartDate", to_char(term2_end_date,'YYYY-MM-DD') AS "term2EndDate", to_char(term3_start_date,'YYYY-MM-DD') AS "term3StartDate", to_char(term3_end_date,'YYYY-MM-DD') AS "term3EndDate" FROM school_profiles WHERE user_id = $1`,
      [context.schoolId],
    );
    const profile = result.rows[0] ?? null;
    if (profile?.logo_key) {
      profile.logoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: imageBucket, Key: profile.logo_key }),
        { expiresIn: 3600 },
      );
      delete profile.logo_key;
    }
    return c.json(profile);
  });
  app.post("/api/school-profile/logo", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to upload a school logo." }, 403);
    const type =
      String(c.req.header("Content-Type") || "")
        .split(";")[0]
        ?.toLowerCase() || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type))
      return c.json({ error: "Use a JPG, PNG, or WEBP image." }, 415);
    const bytes = Buffer.from(await c.req.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      return c.json({ error: "Logo must be smaller than 5 MB." }, 413);
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (
      !(type === "image/jpeg" && jpeg) &&
      !(type === "image/png" && png) &&
      !(type === "image/webp" && webp)
    )
      return c.json({ error: "Image content does not match the selected file type." }, 415);
    const old = await pool.query("SELECT logo_key FROM school_profiles WHERE user_id=$1", [
      context.schoolId,
    ]);
    if (!old.rowCount) return c.json({ error: "School profile not found." }, 404);
    const ext = type === "image/jpeg" ? "jpg" : type.slice(6),
      key = "schools/" + context.schoolId + "/logo/" + randomUUID() + "." + ext;
    await s3.send(
      new PutObjectCommand({ Bucket: imageBucket, Key: key, Body: bytes, ContentType: type }),
    );
    try {
      await pool.query("UPDATE school_profiles SET logo_key=$2,updated_at=now() WHERE user_id=$1", [
        context.schoolId,
        key,
      ]);
    } catch (error) {
      await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: key }));
      throw error;
    }
    if (old.rows[0].logo_key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: old.rows[0].logo_key }));
      } catch (error) {
        console.error("Could not remove replaced school logo", error);
      }
    }
    const logoUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: imageBucket, Key: key }),
      { expiresIn: 3600 },
    );
    return c.json({ logoUrl }, 201);
  });
  app.post("/api/school-profile", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.schoolName !== "string" || !body.schoolName.trim())
      return c.json({ error: "School name is required." }, 400);
    const userId = c.get("userId");
    const values = ["schoolType", "email", "phone", "address", "website", "motto"].map((key) =>
      typeof body[key] === "string" ? (body[key] as string).trim() : "",
    );
    const result = await pool.query(
      `INSERT INTO school_profiles (user_id, school_name, school_type, contact_email, phone, address, website, motto, trial_started_at, subscription_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now()+interval '30 days') ON CONFLICT(user_id) DO UPDATE SET school_name=EXCLUDED.school_name, school_type=EXCLUDED.school_type, contact_email=EXCLUDED.contact_email, phone=EXCLUDED.phone, address=EXCLUDED.address, website=EXCLUDED.website, motto=EXCLUDED.motto, updated_at=now()
       RETURNING school_name, school_type, contact_email, phone, address, website, motto`,
      [userId, body.schoolName.trim(), ...values],
    );
    await pool.query(
      "INSERT INTO school_staff (user_id, school_owner_id, email, full_name, role, permissions) VALUES ($1,$1,$2,$3,'Admin',$4::jsonb) ON CONFLICT (user_id) DO NOTHING",
      [userId, c.get("userEmail"), c.get("userName"), JSON.stringify(allPermissions)],
    );
    return c.json(result.rows[0]);
  });
  app.put("/api/school-profile", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to edit school settings." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.schoolName !== "string" || !body.schoolName.trim())
      return c.json({ error: "School name is required." }, 400);
    const term = typeof body.activeTerm === "string" ? body.activeTerm : "";
    if (term && !["Term 1", "Term 2", "Term 3"].includes(term))
      return c.json({ error: "Choose Term 1, Term 2, or Term 3." }, 400);
    const academicYear = typeof body.academicYear === "string" ? body.academicYear.trim() : "";
    if (academicYear && !/^20\d{2}$/.test(academicYear))
      return c.json({ error: "Academic year must be a four-digit year." }, 400);
    const fields = [
      "schoolName",
      "schoolType",
      "email",
      "phone",
      "address",
      "website",
      "motto",
      "vision",
    ];
    const vals = fields.map((key) =>
      typeof body[key] === "string" ? (body[key] as string).trim() : "",
    );
    const dates = [
      "term1StartDate",
      "term1EndDate",
      "term2StartDate",
      "term2EndDate",
      "term3StartDate",
      "term3EndDate",
    ].map((key) => (typeof body[key] === "string" ? body[key] : ""));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const old = await client.query(
        "SELECT academic_year,active_term FROM school_profiles WHERE user_id=$1 FOR UPDATE",
        [context.schoolId],
      );
      const result = await client.query(
        `UPDATE school_profiles SET school_name=$2,school_type=$3,contact_email=$4,phone=$5,address=$6,website=$7,motto=$8,vision=$9,academic_year=$10,active_term=$11,term1_start_date=NULLIF($12,'')::date,term1_end_date=NULLIF($13,'')::date,term2_start_date=NULLIF($14,'')::date,term2_end_date=NULLIF($15,'')::date,term3_start_date=NULLIF($16,'')::date,term3_end_date=NULLIF($17,'')::date,updated_at=now() WHERE user_id=$1 RETURNING school_name,school_type,contact_email,phone,address,website,motto,vision,academic_year AS "academicYear",active_term AS "activeTerm",to_char(term1_start_date,'YYYY-MM-DD') AS "term1StartDate",to_char(term1_end_date,'YYYY-MM-DD') AS "term1EndDate",to_char(term2_start_date,'YYYY-MM-DD') AS "term2StartDate",to_char(term2_end_date,'YYYY-MM-DD') AS "term2EndDate",to_char(term3_start_date,'YYYY-MM-DD') AS "term3StartDate",to_char(term3_end_date,'YYYY-MM-DD') AS "term3EndDate"`,
        [context.schoolId, ...vals, academicYear, term, ...dates],
      );
      const previousTerm = old.rows[0]
        ? `${old.rows[0].active_term} ${old.rows[0].academic_year}`.trim()
        : "";
      const currentTerm = `${term} ${academicYear}`.trim();
      let generatedFees = 0;
      if (term && academicYear && previousTerm !== currentTerm) {
        const number = Number(term.match(/[123]/)?.[0]);
        const termKey = `term${number}Fee`;
        const generated = await client.query(
          `INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment)
          SELECT s.school_owner_id,s.id,$2,'Fee obligation',COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric,CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)+COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee),c.name||' term fees'
          FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name
          WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees') RETURNING id`,
          [context.schoolId, currentTerm, termKey, number],
        );
        generatedFees = generated.rowCount ?? 0;
      }
      await client.query("COMMIT");
      return c.json({ ...result.rows[0], generatedFees });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.get("/api/students", async (c) => {
    const context = await guard(c, "view_students");
    if (!context) return c.json({ error: "Not allowed to view students." }, 403);
    const result = await pool.query(
      'SELECT id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, guardian_email AS "guardianEmail", phone, address, admitted_on AS admitted, status FROM school_students WHERE school_owner_id=$1 ORDER BY last_name,first_name',
      [context.schoolId],
    );
    return c.json(result.rows);
  });
  app.post("/api/students", async (c) => {
    const context = await guard(c, "edit_students");
    if (!context) return c.json({ error: "Not allowed to edit students." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      !b ||
      typeof b.first !== "string" ||
      !b.first.trim() ||
      typeof b.last !== "string" ||
      !b.last.trim()
    )
      return c.json({ error: "First and last name are required." }, 400);
    const className = typeof b.class === "string" ? b.class.trim() : "";
    const stream = typeof b.stream === "string" ? b.stream.trim() : "";
    if (!["Male", "Female"].includes(String(b.gender)) || !className || !stream)
      return c.json({ error: "Choose a gender, class, and stream." }, 400);
    const classRow = await pool.query(
      "SELECT streams FROM school_classes WHERE school_owner_id=$1 AND name=$2",
      [context.schoolId, className],
    );
    if (!classRow.rowCount || !(classRow.rows[0].streams as string[]).includes(stream))
      return c.json({ error: "Choose a stream configured for the selected class." }, 400);
    const adm =
      typeof b.adm === "string" && b.adm.trim()
        ? b.adm.trim()
        : `SY-${randomUUID().slice(0, 8).toUpperCase()}`;
    const vals = [
      b.gender,
      b.dob,
      className,
      stream,
      b.guardian,
      String(b.guardianEmail || "")
        .trim()
        .toLowerCase(),
      b.phone,
      b.address,
      b.admitted,
      b.status,
    ].map((v) => (typeof v === "string" ? v : ""));
    try {
      const result = await pool.query(
        `INSERT INTO school_students (school_owner_id,admission_no,first_name,last_name,gender,date_of_birth,class_name,stream,guardian,guardian_email,phone,address,admitted_on,status)
         VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,$7,$8,$9,$10,$11,$12,COALESCE(NULLIF($13,'')::date,CURRENT_DATE),COALESCE(NULLIF($14,''),'Active'))
         ON CONFLICT (school_owner_id,admission_no) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,gender=EXCLUDED.gender,date_of_birth=EXCLUDED.date_of_birth,class_name=EXCLUDED.class_name,stream=EXCLUDED.stream,guardian=EXCLUDED.guardian,guardian_email=EXCLUDED.guardian_email,phone=EXCLUDED.phone,address=EXCLUDED.address,status=EXCLUDED.status
         RETURNING id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, guardian_email AS "guardianEmail", phone, address, admitted_on AS admitted, status`,
        [context.schoolId, adm, b.first.trim(), b.last.trim(), ...vals],
      );
      const student = result.rows[0];
      if (student.status === "Active") {
        const profile = await pool.query(
          "SELECT active_term,academic_year FROM school_profiles WHERE user_id=$1",
          [context.schoolId],
        );
        const match = String(profile.rows[0]?.active_term || "").match(/[123]/),
          year = String(profile.rows[0]?.academic_year || "");
        if (match && year) {
          const n = Number(match[0]),
            term = profile.rows[0].active_term + " " + year,
            key = "term" + n + "Fee";
          await pool.query(
            "INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment) SELECT s.school_owner_id,s.id,$3,'Fee obligation',COALESCE(NULLIF(cl.stream_fees->s.stream->>$4,'')::numeric,CASE $5::int WHEN 1 THEN cl.term1_fee WHEN 2 THEN cl.term2_fee ELSE cl.term3_fee END)+COALESCE(NULLIF(cl.stream_fees->s.stream->>'extraFee','')::numeric,cl.extra_fee),cl.name||' term fees' FROM school_students s JOIN school_classes cl ON cl.school_owner_id=s.school_owner_id AND cl.name=s.class_name WHERE s.id=$1 AND s.school_owner_id=$2 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.student_id=s.id AND f.school_owner_id=s.school_owner_id AND f.term=$3 AND f.entry_type='Fee obligation' AND f.comment=cl.name||' term fees')",
            [student.id, context.schoolId, term, key, n],
          );
        }
      }
      return c.json(student, 201);
    } catch (error) {
      return c.json(
        { error: "Could not save the student. Check the admission number and dates." },
        400,
      );
    }
  });
  app.post("/api/students/promote", async (c) => {
    const context = await guard(c, "edit_students");
    if (!context) return c.json({ error: "Not allowed to promote students." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const currentClass = typeof body?.currentClass === "string" ? body.currentClass.trim() : "";
    const action = ["suspend", "promote", "resume"].includes(String(body?.action))
      ? String(body?.action)
      : "";
    const targetClass = typeof body?.targetClass === "string" ? body.targetClass.trim() : "";
    if (
      !currentClass ||
      !action ||
      (action === "promote" && (!targetClass || targetClass === currentClass))
    )
      return c.json({ error: "Choose a current class and a valid promotion action." }, 400);
    const profile = await pool.query("SELECT academic_year FROM school_profiles WHERE user_id=$1", [
      context.schoolId,
    ]);
    const year = String(profile.rows[0]?.academic_year || new Date().getFullYear());
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await client.query(
        "SELECT id,stream FROM school_students WHERE school_owner_id=$1 AND class_name=$2 AND status=$3 FOR UPDATE",
        [context.schoolId, currentClass, action === "resume" ? "Suspended" : "Active"],
      );
      if (!students.rowCount) {
        await client.query("COMMIT");
        return c.json({ updated: 0, action });
      }
      if (action === "suspend") {
        await client.query(
          "UPDATE school_students SET status='Suspended' WHERE school_owner_id=$1 AND class_name=$2 AND status='Active'",
          [context.schoolId, currentClass],
        );
      } else if (action === "resume") {
        await client.query(
          "UPDATE school_students SET status='Active' WHERE school_owner_id=$1 AND class_name=$2 AND status='Suspended'",
          [context.schoolId, currentClass],
        );
      } else {
        const destination = await client.query(
          "SELECT streams,term1_fee,extra_fee,stream_fees FROM school_classes WHERE school_owner_id=$1 AND name=$2 FOR SHARE",
          [context.schoolId, targetClass],
        );
        if (!destination.rowCount) {
          await client.query("ROLLBACK");
          return c.json({ error: "The destination class was not found." }, 404);
        }
        const streams = destination.rows[0].streams as string[];
        if (!streams.length) {
          await client.query("ROLLBACK");
          return c.json({ error: "Add at least one stream to the destination class first." }, 400);
        }
        const term = `Term 1 ${year}`;
        for (const student of students.rows) {
          const stream = streams.includes(student.stream) ? student.stream : streams[0];
          await client.query(
            "UPDATE school_students SET class_name=$3,stream=$4 WHERE id=$1 AND school_owner_id=$2",
            [student.id, context.schoolId, targetClass, stream],
          );
          const overrides = (destination.rows[0].stream_fees || {}) as Record<
            string,
            { term1Fee?: number | null; extraFee?: number | null }
          >;
          const fee = overrides[stream]?.term1Fee ?? Number(destination.rows[0].term1_fee || 0);
          const extra = overrides[stream]?.extraFee ?? Number(destination.rows[0].extra_fee || 0);
          await client.query(
            `INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment)
             SELECT $1,$2,$3,'Fee obligation',$4,$5
             WHERE NOT EXISTS(SELECT 1 FROM school_fee_entries WHERE school_owner_id=$1 AND student_id=$2 AND term=$3 AND entry_type='Fee obligation' AND comment=$5)`,
            [
              context.schoolId,
              student.id,
              term,
              Number(fee) + Number(extra),
              `${targetClass} term fees`,
            ],
          );
        }
      }
      await client.query("COMMIT");
      return c.json({
        updated: students.rowCount || 0,
        action,
        term: action === "promote" ? `Term 1 ${year}` : undefined,
      });
    } catch {
      await client.query("ROLLBACK");
      return c.json(
        { error: "Could not complete the class action. No student changes were saved." },
        400,
      );
    } finally {
      client.release();
    }
  });
  app.get("/api/students/:id", async (c) => {
    const context = await guard(c, "view_students");
    if (!context) return c.json({ error: "Not allowed to view students." }, 403);
    const student = await pool.query(
      'SELECT id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, guardian_email AS "guardianEmail", phone, address, admitted_on AS admitted, status, photo_key AS "photoKey" FROM school_students WHERE id=$1 AND school_owner_id=$2',
      [c.req.param("id"), context.schoolId],
    );
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const row = student.rows[0];
    const photoUrl = row.photoKey
      ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: imageBucket, Key: row.photoKey }), {
          expiresIn: 3600,
        })
      : "";
    const fees = await pool.query(
      "SELECT id, entry_date AS date, term, entry_type AS entry, debit, credit, method, reference, comment FROM school_fee_entries WHERE student_id=$1 AND school_owner_id=$2 ORDER BY entry_date DESC,created_at DESC",
      [c.req.param("id"), context.schoolId],
    );
    return c.json({ student: { ...row, photoUrl }, fees: fees.rows });
  });
  app.post("/api/students/:id/photo", async (c) => {
    const context = await guard(c, "edit_students");
    if (!context) return c.json({ error: "Not allowed to upload student photos." }, 403);
    const student = await pool.query(
      "SELECT photo_key FROM school_students WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const contentType =
      String(c.req.header("Content-Type") || "")
        .split(";")[0]
        ?.toLowerCase() || "";
    const types = ["image/jpeg", "image/png", "image/webp"];
    if (!types.includes(contentType))
      return c.json({ error: "Use a JPG, PNG, or WEBP image." }, 415);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length || bytes.byteLength > 10 * 1024 * 1024)
      return c.json({ error: "Choose an image no larger than 10 MB." }, 413);
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png =
      bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
    const webp =
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (
      !(contentType === "image/jpeg" && jpeg) &&
      !(contentType === "image/png" && png) &&
      !(contentType === "image/webp" && webp)
    )
      return c.json({ error: "The file contents do not match a JPG, PNG, or WEBP image." }, 415);
    const ext = contentType === "image/jpeg" ? "jpg" : contentType.slice(6);
    const key = `students/${context.schoolId}/${c.req.param("id")}/${randomUUID()}.${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: imageBucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "private, max-age=300",
      }),
    );
    try {
      await pool.query(
        "UPDATE school_students SET photo_key=$3 WHERE id=$1 AND school_owner_id=$2",
        [c.req.param("id"), context.schoolId, key],
      );
    } catch (error) {
      await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: key }));
      throw error;
    }
    const previous = student.rows[0].photo_key;
    if (previous) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: previous }));
      } catch (error) {
        console.error("Could not remove replaced student photo", error);
      }
    }
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: imageBucket, Key: key }), {
      expiresIn: 3600,
    });
    return c.json({ photoUrl: url }, 201);
  });
  app.post("/api/students/:id/fees", async (c) => {
    const context = await guard(c, "edit_fees");
    if (!context) return c.json({ error: "Not allowed to record fees." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const allowed = ["Payment", "Debt added", "Credit added", "Adjust balance"];
    const entry = String(b?.entry || "");
    const amount = Number(b?.amount);
    if (
      !b ||
      !allowed.includes(entry) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (entry !== "Adjust balance" && amount <= 0)
    )
      return c.json({ error: "Choose a valid fee entry and amount." }, 400);
    const method = typeof b.method === "string" ? b.method : "";
    if (entry === "Payment" && !["M-Pesa", "Cash", "Bank", "Card", "Other"].includes(method))
      return c.json({ error: "Choose a valid payment method." }, 400);
    const comment = typeof b.comment === "string" ? b.comment.trim() : "";
    const reason =
      comment ||
      (entry === "Adjust balance"
        ? "Student balance adjusted by school administrator."
        : entry === "Debt added"
          ? "Additional fee balance recorded."
          : entry === "Credit added"
            ? "Fee credit adjustment recorded."
            : `Fee payment recorded${typeof b.reference === "string" && b.reference.trim() ? `; receipt ${b.reference.trim()}` : ""}.`);
    const entryDate =
      typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)
        ? b.date
        : new Date().toISOString().slice(0, 10);
    const requestKey =
      typeof b.requestId === "string" && b.requestId.length <= 100 ? b.requestId : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const student = await client.query(
        "SELECT id FROM school_students WHERE id=$1 AND school_owner_id=$2 FOR UPDATE",
        [c.req.param("id"), context.schoolId],
      );
      if (!student.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Student not found." }, 404);
      }
      if (requestKey) {
        const prior = await client.query(
          "SELECT id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment FROM school_fee_entries WHERE school_owner_id=$1 AND request_key=$2",
          [context.schoolId, requestKey],
        );
        if (prior.rowCount) {
          await client.query("COMMIT");
          return c.json(prior.rows[0]);
        }
      }
      const current = await client.query(
        "SELECT COALESCE(sum(debit-credit),0) AS balance FROM school_fee_entries WHERE school_owner_id=$1 AND student_id=$2",
        [context.schoolId, c.req.param("id")],
      );
      const previousBalance = Number(current.rows[0].balance);
      let debit = entry === "Debt added" ? amount : 0;
      let credit = entry === "Credit added" || entry === "Payment" ? amount : 0;
      let details =
        reason ||
        (entry === "Payment"
          ? `Fee payment received via ${method}${typeof b.reference === "string" && b.reference.trim() ? `; receipt ${b.reference.trim()}` : ""}.`
          : "");
      if (entry === "Adjust balance") {
        debit = Math.max(0, amount - previousBalance);
        credit = Math.max(0, previousBalance - amount);
        details = `Previous balance: KES ${previousBalance.toFixed(2)}; new balance: KES ${amount.toFixed(2)}. Reason: ${reason}`;
      }
      const result = await client.query(
        "INSERT INTO school_fee_entries(school_owner_id,student_id,entry_date,term,entry_type,debit,credit,method,reference,comment,request_key) VALUES($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment",
        [
          context.schoolId,
          c.req.param("id"),
          entryDate,
          typeof b.term === "string" ? b.term.trim() : "",
          entry,
          debit,
          credit,
          method,
          typeof b.reference === "string" ? b.reference.trim() : "",
          details,
          requestKey,
        ],
      );
      await client.query("COMMIT");
      return c.json({ ...result.rows[0], balance: previousBalance + debit - credit }, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      if (requestKey && (error as { code?: string }).code === "23505") {
        const prior = await pool.query(
          "SELECT id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment FROM school_fee_entries WHERE school_owner_id=$1 AND request_key=$2",
          [context.schoolId, requestKey],
        );
        if (prior.rowCount) return c.json(prior.rows[0]);
      }
      return c.json({ error: "Could not record the fee entry." }, 400);
    } finally {
      client.release();
    }
  });

  app.delete("/api/students/:id", async (c) => {
    const context = await guard(c, "edit_students");
    if (!context) return c.json({ error: "Not allowed to edit students." }, 403);
    const found = await pool.query(
      "SELECT photo_key FROM school_students WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (!found.rowCount) return c.json({ error: "Student not found." }, 404);
    await pool.query("DELETE FROM school_students WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      context.schoolId,
    ]);
    if (found.rows[0].photo_key)
      await s3.send(new DeleteObjectCommand({ Bucket: imageBucket, Key: found.rows[0].photo_key }));
    return c.json({ ok: true });
  });
  app.get("/api/fees", async (c) => {
    const context = await guard(c, "view_fees");
    if (!context) return c.json({ error: "Not allowed to view fees." }, 403);
    const result = await pool.query(
      `SELECT s.id, s.admission_no AS adm, s.first_name AS first, s.last_name AS last, s.class_name AS class,
      COALESCE(sum(f.debit),0) AS billed, COALESCE(sum(f.credit),0) AS paid, COALESCE(sum(f.debit-f.credit),0) AS balance
      FROM school_students s LEFT JOIN school_fee_entries f ON f.student_id=s.id AND f.school_owner_id=s.school_owner_id
      WHERE s.school_owner_id=$1 GROUP BY s.id ORDER BY s.last_name,s.first_name`,
      [context.schoolId],
    );
    return c.json(result.rows);
  });
  app.get("/api/fee-students", async (c) => {
    const context = await guard(c, "view_fees");
    if (!context) return c.json({ error: "Not allowed to search fee accounts." }, 403);
    const query = String(c.req.query("q") || "").trim();
    if (query.length < 2) return c.json([]);
    const result = await pool.query(
      `SELECT id,admission_no AS adm,first_name AS first,last_name AS last,class_name AS class,stream
       FROM school_students WHERE school_owner_id=$1 AND (admission_no ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR (first_name||' '||last_name) ILIKE $2)
       ORDER BY last_name,first_name LIMIT 25`,
      [context.schoolId, `%${query}%`],
    );
    return c.json(result.rows);
  });
  app.get("/api/reports/students", async (c) => {
    const x = await guard(c, "view_students");
    if (!x) return c.json({ error: "Not allowed to view student reports." }, 403);
    const className = String(c.req.query("class") || "");
    const stream = String(c.req.query("stream") || "");
    const r = await pool.query(
      `SELECT admission_no AS adm,first_name AS first,last_name AS last,gender,class_name AS class,stream,guardian,phone,status FROM school_students WHERE school_owner_id=$1 AND ($2='' OR class_name=$2) AND ($3='' OR stream=$3) ORDER BY class_name,stream,last_name,first_name`,
      [x.schoolId, className, stream],
    );
    return c.json(r.rows);
  });
  app.get("/api/reports/fees", async (c) => {
    const x = await guard(c, "view_fees");
    if (!x) return c.json({ error: "Not allowed to view fee reports." }, 403);
    const term = String(c.req.query("term") || "");
    const className = String(c.req.query("class") || "");
    const stream = String(c.req.query("stream") || "");
    const r = await pool.query(
      `SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,COALESCE(sum(f.debit),0) AS billed,COALESCE(sum(f.credit),0) AS paid,COALESCE(sum(f.debit-f.credit),0) AS balance FROM school_students s LEFT JOIN school_fee_entries f ON f.student_id=s.id AND f.school_owner_id=s.school_owner_id AND ($2='' OR f.term=$2) WHERE s.school_owner_id=$1 AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) GROUP BY s.id ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,
      [x.schoolId, term, className, stream],
    );
    return c.json(r.rows);
  });
  app.get("/api/reports/attendance", async (c) => {
    const x = await guard(c, "view_attendance");
    if (!x) return c.json({ error: "Not allowed to view attendance reports." }, 403);
    const date = String(c.req.query("date") || new Date().toISOString().slice(0, 10));
    const className = String(c.req.query("class") || "");
    const stream = String(c.req.query("stream") || "");
    const r = await pool.query(
      `SELECT s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,COALESCE(a.status,'Not marked') AS status FROM school_students s LEFT JOIN school_attendance a ON a.student_id=s.id AND a.attendance_date=$2 WHERE s.school_owner_id=$1 AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,
      [x.schoolId, date, className, stream],
    );
    return c.json(r.rows);
  });
  app.get("/api/attendance", async (c) => {
    const context = await guard(c, "view_attendance");
    if (!context) return c.json({ error: "Not allowed to view attendance." }, 403);
    const date = String(c.req.query("date") || new Date().toISOString().slice(0, 10));
    const className = String(c.req.query("class") || "");
    const stream = String(c.req.query("stream") || "");
    const result = await pool.query(
      `SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,a.status
      FROM school_students s LEFT JOIN school_attendance a ON a.student_id=s.id AND a.attendance_date=$2
      WHERE s.school_owner_id=$1 AND s.status='Active' AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,
      [context.schoolId, date, className, stream],
    );
    return c.json(result.rows);
  });
  app.post("/api/attendance", async (c) => {
    const context = await guard(c, "edit_attendance");
    if (!context) return c.json({ error: "Not allowed to edit attendance." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      typeof b?.studentId !== "string" ||
      !["Present", "Absent", "Late", "Excused"].includes(String(b.status))
    )
      return c.json({ error: "Choose a student and valid attendance status." }, 400);
    const student = await pool.query(
      "SELECT id FROM school_students WHERE id=$1 AND school_owner_id=$2",
      [b.studentId, context.schoolId],
    );
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const date = typeof b.date === "string" ? b.date : new Date().toISOString().slice(0, 10);
    const r = await pool.query(
      "INSERT INTO school_attendance (school_owner_id,student_id,attendance_date,status,recorded_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by RETURNING id,status",
      [context.schoolId, b.studentId, date, b.status, c.get("userId")],
    );
    return c.json(r.rows[0]);
  });
  app.get("/api/staff", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context) return c.json({ error: "Only school administrators can manage staff." }, 403);
    const result = await pool.query(
      "SELECT user_id AS id,email,full_name AS name,role,permissions,active FROM school_staff WHERE school_owner_id=$1 ORDER BY full_name",
      [context.schoolId],
    );
    return c.json({ staff: result.rows, permissions: allPermissions });
  });
  app.get("/api/accounts", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context || context.role !== "Admin")
      return c.json({ error: "Only the school administrator can view accounts." }, 403);
    const result = await pool.query(
      "SELECT user_id AS id,email,full_name AS name,role,permissions,active FROM school_staff WHERE school_owner_id=$1 ORDER BY role,full_name",
      [context.schoolId],
    );
    return c.json({ accounts: result.rows });
  });
  app.patch("/api/accounts/:id", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context || context.role !== "Admin")
      return c.json({ error: "Only the school administrator can update accounts." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return c.json({ error: "Enter a valid name and email address." }, 400);
    const result = await pool.query(
      "UPDATE school_staff SET full_name=$3,email=$4 WHERE user_id=$1 AND school_owner_id=$2 RETURNING user_id AS id,email,full_name AS name,role,active",
      [c.req.param("id"), context.schoolId, name, email],
    );
    if (!result.rowCount) return c.json({ error: "Account not found in this school." }, 404);
    return c.json(result.rows[0]);
  });
  app.post("/api/staff/invitations", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context) return c.json({ error: "Only school administrators can invite staff." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      !b ||
      typeof b.email !== "string" ||
      !b.email.includes("@") ||
      typeof b.name !== "string" ||
      !b.name.trim()
    )
      return c.json({ error: "A name and valid email are required." }, 400);
    const email = b.email.trim().toLowerCase(),
      name = b.name.trim();
    const role =
      typeof b.role === "string" && b.role in rolePermissions && b.role !== "Admin"
        ? b.role
        : "Teacher";
    const requested = Array.isArray(b.permissions)
      ? b.permissions.filter((p): p is Permission => allPermissions.includes(p as Permission))
      : rolePermissions[role];
    const shouldSendEmail = b.sendEmail === true;
    const configuredUrl = String(
      (typeof b.appOrigin === "string" && b.appOrigin) ||
        c.req.header("Origin") ||
        process.env.SHULE_YETU_APP_URL ||
        "",
    );
    let appOrigin = "";
    try {
      const parsed = new URL(configuredUrl);
      if (
        parsed.protocol === "https:" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1"
      )
        appOrigin = parsed.origin;
    } catch {
      /* Return a clear setup error below for invalid URLs. */
    }
    if (!appOrigin)
      return c.json(
        { error: "Could not determine the school website address for the invitation link." },
        400,
      );
    const inviteCode = randomUUID();
    try {
      const result = await pool.query(
        "INSERT INTO school_invites(school_owner_id,invite_code,email,full_name,role,permissions) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(school_owner_id,email) DO UPDATE SET invite_code=EXCLUDED.invite_code,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,expires_at=now()+interval '7 days' RETURNING invite_code,email,full_name,role,expires_at",
        [context.schoolId, inviteCode, email, name, role, JSON.stringify(requested)],
      );
      const invite = result.rows[0],
        inviteUrl = new URL("/register", appOrigin);
      inviteUrl.searchParams.set("invite", invite.invite_code);
      let emailSent = false,
        emailError = "";
      if (shouldSendEmail) {
        const apiKey = process.env.RESEND_API_KEY,
          from = process.env.RESEND_FROM_EMAIL;
        if (!apiKey || !from)
          emailError =
            "Email sending is not configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the Neon Function environment.";
        else {
          const link = inviteUrl.toString();
          try {
            const sent = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: [String(invite.email)],
                subject: "Invitation to join " + String(context.name) + " on Shule Yetu",
                text:
                  "Hello " +
                  name +
                  ",\n\n" +
                  String(context.name) +
                  " has invited you to join its school team on Shule Yetu. Open this link to create your account and join: " +
                  link +
                  "\n\nThis invitation expires in 7 days.",
                html:
                  "<p>Hello " +
                  escapeHtml(name) +
                  "</p><p>" +
                  escapeHtml(String(context.name)) +
                  ' has invited you to join its school team on Shule Yetu.</p><p><a href="' +
                  escapeHtml(link) +
                  '">Accept the invitation</a></p><p>This invitation expires in 7 days.</p>',
              }),
            });
            if (sent.ok) emailSent = true;
            else {
              console.error("Resend invitation email failed with status", sent.status);
              emailError =
                "The invitation was created, but Resend could not send the email. Copy and send the invitation link instead.";
            }
          } catch (error) {
            console.error("Resend invitation email request failed", error);
            emailError =
              "The invitation was created, but the email service could not be reached. Copy and send the invitation link instead.";
          }
        }
      }
      return c.json({ ...invite, inviteUrl: inviteUrl.toString(), emailSent, emailError }, 201);
    } catch {
      return c.json({ error: "That email is already registered with this school." }, 409);
    }
  });
  app.patch("/api/staff/:id", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context) return c.json({ error: "Only school administrators can update staff." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const permissions = Array.isArray(b?.permissions)
      ? b.permissions.filter((p): p is Permission => allPermissions.includes(p as Permission))
      : [];
    const role = typeof b?.role === "string" && b.role in rolePermissions ? b.role : "Teacher";
    const result = await pool.query(
      "UPDATE school_staff SET role=$3,permissions=$4::jsonb,active=COALESCE($5::boolean,active) WHERE user_id=$1 AND school_owner_id=$2 AND role<>'Admin' RETURNING user_id AS id,email,full_name AS name,role,permissions,active",
      [
        c.req.param("id"),
        context.schoolId,
        role,
        JSON.stringify(permissions),
        typeof b?.active === "boolean" ? b.active : null,
      ],
    );
    if (!result.rowCount) return c.json({ error: "Staff member not found or protected." }, 404);
    return c.json(result.rows[0]);
  });
  app.get("/api/staff/:id/assignments", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context) return c.json({ error: "Only administrators can view assignments." }, 403);
    const result = await pool.query(
      `SELECT a.id,a.class_id AS "classId",c.name AS "className",a.stream,a.subjects FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id AND c.school_owner_id=a.school_owner_id WHERE a.school_owner_id=$1 AND a.user_id=$2 ORDER BY c.name,a.stream`,
      [context.schoolId, c.req.param("id")],
    );
    return c.json(result.rows);
  });
  app.put("/api/staff/:id/assignments", async (c) => {
    const context = await guard(c, "manage_staff");
    if (!context) return c.json({ error: "Only administrators can edit assignments." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const rows = Array.isArray(body?.assignments)
      ? (body.assignments as Record<string, unknown>[])
      : null;
    if (!rows) return c.json({ error: "Assignments must be a list." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const member = await client.query(
        "SELECT user_id FROM school_staff WHERE user_id=$1 AND school_owner_id=$2 AND role='Teacher' FOR UPDATE",
        [c.req.param("id"), context.schoolId],
      );
      if (!member.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Teacher not found." }, 404);
      }
      const clean: Array<{ classId: string; stream: string; subjects: string[] }> = [];
      for (const row of rows) {
        const classId = typeof row.classId === "string" ? row.classId : "";
        const stream = typeof row.stream === "string" ? row.stream.trim() : "";
        const cls = await client.query(
          "SELECT name,streams,subjects FROM school_classes WHERE id=$1 AND school_owner_id=$2",
          [classId, context.schoolId],
        );
        if (!cls.rowCount || (cls.rows[0].streams as string[]).indexOf(stream) < 0) {
          await client.query("ROLLBACK");
          return c.json(
            { error: "Every assignment must use a configured class and one of its streams." },
            400,
          );
        }
        const valid = cls.rows[0].subjects as string[];
        const subjects = Array.isArray(row.subjects)
          ? row.subjects.filter((x): x is string => typeof x === "string")
          : [];
        if (!subjects.length || subjects.some((subject) => !valid.includes(subject))) {
          await client.query("ROLLBACK");
          return c.json({ error: `Choose subjects configured for ${cls.rows[0].name}.` }, 400);
        }
        if (clean.some((x) => x.classId === classId && x.stream === stream)) {
          await client.query("ROLLBACK");
          return c.json({ error: "Remove duplicate class and stream assignment rows." }, 400);
        }
        clean.push({ classId, stream, subjects });
      }
      await client.query(
        "DELETE FROM school_teacher_assignments WHERE school_owner_id=$1 AND user_id=$2",
        [context.schoolId, c.req.param("id")],
      );
      for (const row of clean)
        await client.query(
          "INSERT INTO school_teacher_assignments(school_owner_id,user_id,class_id,stream,subjects) VALUES($1,$2,$3,$4,$5::jsonb)",
          [
            context.schoolId,
            c.req.param("id"),
            row.classId,
            row.stream,
            JSON.stringify(row.subjects),
          ],
        );
      await client.query("COMMIT");
      return c.json({ assignments: clean.length });
    } catch (error) {
      await client.query("ROLLBACK");
      return c.json({ error: "Could not save teacher assignments." }, 400);
    } finally {
      client.release();
    }
  });
  app.post("/api/staff/accept-invite", async (c) => {
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (typeof b?.code !== "string") return c.json({ error: "Invitation code required." }, 400);
    const email = String(c.get("userEmail") || "")
      .trim()
      .toLowerCase();
    if (!email)
      return c.json({ error: "Sign in with the email address that received the invitation." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT school_owner_id,email,full_name,role,permissions FROM school_invites WHERE invite_code=$1 AND expires_at>now() FOR UPDATE",
        [b.code],
      );
      if (!found.rowCount) {
        await client.query("ROLLBACK");
        return c.json(
          {
            error:
              "This invitation is invalid or expired. Ask the school administrator to send a new link.",
          },
          400,
        );
      }
      const i = found.rows[0];
      const invitationEmail = String(i.email).normalize("NFKC").trim().toLowerCase();
      const signedInEmail = email.normalize("NFKC");
      if (invitationEmail !== signedInEmail) {
        await client.query("ROLLBACK");
        return c.json(
          {
            error: `Invitation email: ${i.email}. Signed-in email: ${c.get("userEmail") || "not provided by the current session"}. Sign out of the other account and use the invited email.`,
          },
          400,
        );
      }
      await client.query(
        "INSERT INTO school_staff(user_id,school_owner_id,email,full_name,role,permissions) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(user_id) DO UPDATE SET school_owner_id=EXCLUDED.school_owner_id,email=EXCLUDED.email,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,active=true",
        [
          c.get("userId"),
          i.school_owner_id,
          i.email,
          i.full_name,
          i.role,
          JSON.stringify(i.permissions),
        ],
      );
      await client.query("DELETE FROM school_invites WHERE invite_code=$1", [b.code]);
      await client.query("COMMIT");
      return c.json({ ok: true, schoolOwnerId: i.school_owner_id });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.get("/api/staff/invitation/:code", async (c) => {
    const result = await pool.query(
      `SELECT i.email,i.full_name AS name,i.role,p.school_name AS "schoolName" FROM school_invites i JOIN school_profiles p ON p.user_id=i.school_owner_id WHERE i.invite_code=$1 AND i.expires_at>now()`,
      [c.req.param("code")],
    );
    if (!result.rowCount)
      return c.json({ error: "This invitation is invalid or has expired." }, 404);
    return c.json(result.rows[0]);
  });
  app.get("/api/classes", async (c) => {
    const x = await contextFor(c);
    if (
      !x ||
      (!x.permissions.includes("view_classes") &&
        !x.permissions.includes("view_students") &&
        !x.permissions.includes("edit_students") &&
        x.role !== "Admin")
    )
      return c.json({ error: "Not allowed to view classes." }, 403);
    return c.json(
      (
        await pool.query(
          `SELECT id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees" FROM school_classes WHERE school_owner_id=$1 ORDER BY name`,
          [x.schoolId],
        )
      ).rows,
    );
  });
  app.post("/api/classes", async (c) => {
    const x = await guard(c, "edit_classes");
    if (!x) return c.json({ error: "Not allowed to edit classes." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (typeof b?.name !== "string" || !b.name.trim())
      return c.json({ error: "Class name is required." }, 400);
    const strings = (v: unknown) =>
      Array.isArray(v)
        ? v
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim())
            .filter(Boolean)
        : [];
    const streams = strings(b.streams),
      subjects = strings(b.subjects);
    const fee = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    const streamFees =
      typeof b.streamFees === "object" && b.streamFees !== null
        ? (b.streamFees as Record<string, unknown>)
        : {};
    for (const key of Object.keys(streamFees))
      if (!streams.includes(key))
        return c.json(
          { error: `Fee override stream '${key}' is not configured for this class.` },
          400,
        );
    const optionalFee = (v: unknown): number | null =>
      v === null || v === undefined || v === ""
        ? null
        : typeof v === "number" && Number.isFinite(v) && v >= 0
          ? v
          : null;
    const cleanOverrides: Record<
      string,
      {
        term1Fee: number | null;
        term2Fee: number | null;
        term3Fee: number | null;
        extraFee: number | null;
      }
    > = {};
    for (const stream of streams) {
      const value =
        typeof streamFees[stream] === "object" && streamFees[stream] !== null
          ? (streamFees[stream] as Record<string, unknown>)
          : {};
      cleanOverrides[stream] = {
        term1Fee: optionalFee(value.term1Fee),
        term2Fee: optionalFee(value.term2Fee),
        term3Fee: optionalFee(value.term3Fee),
        extraFee: optionalFee(value.extraFee),
      };
    }
    const t1 = fee(b.term1Fee),
      t2 = fee(b.term2Fee),
      t3 = fee(b.term3Fee),
      extra = fee(b.extraFee);
    const duplicate = await pool.query(
      "SELECT 1 FROM school_classes WHERE school_owner_id=$1 AND lower(name)=lower($2)",
      [x.schoolId, b.name.trim()],
    );
    if (duplicate.rowCount)
      return c.json(
        { error: "This class already exists. Open it above to edit its streams or fees." },
        409,
      );
    const result = await pool.query(
      `INSERT INTO school_classes(school_owner_id,name,streams,subjects,term_fee,term1_fee,term2_fee,term3_fee,extra_fee,stream_fees) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(school_owner_id,name) DO NOTHING RETURNING id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees"`,
      [
        x.schoolId,
        b.name.trim(),
        JSON.stringify(streams),
        JSON.stringify(subjects),
        t1,
        t2,
        t3,
        extra,
        JSON.stringify(cleanOverrides),
      ],
    );
    if (!result.rowCount)
      return c.json(
        { error: "This class already exists. Open it above to edit its streams or fees." },
        409,
      );
    return c.json(result.rows[0], 201);
  });
  app.post("/api/classes/generate-fees", async (c) => {
    const x = await guard(c, "edit_fees");
    if (!x) return c.json({ error: "Not allowed to generate fee obligations." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const term = typeof b?.term === "string" ? b.term.trim() : "";
    const match = term.match(/\bterm\s*([123])\b/i);
    if (!match) return c.json({ error: "Enter a term such as Term 1 2027." }, 400);
    const termNumber = Number(match[1]);
    const termKey = `term${termNumber}Fee`;
    const r = await pool.query(
      `INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment)
      SELECT s.school_owner_id,s.id,$2,'Fee obligation',
        COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric, CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)
        + COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee), c.name||' term fees'
      FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name
      WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees')
      RETURNING id`,
      [x.schoolId, term, termKey, termNumber],
    );
    return c.json({ created: r.rowCount ?? 0, term });
  });
  app.put("/api/classes/:id", async (c) => {
    const x = await guard(c, "edit_classes");
    if (!x) return c.json({ error: "Not allowed." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const list = (v: unknown) =>
      Array.isArray(v)
        ? v
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim())
            .filter(Boolean)
        : [];
    const streams = list(b?.streams),
      subjects = list(b?.subjects);
    const existing = await pool.query(
      "SELECT name,streams FROM school_classes WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (!existing.rowCount) return c.json({ error: "Class not found." }, 404);
    const removed = (existing.rows[0].streams as string[]).filter((s) => !streams.includes(s));
    if (removed.length) {
      const assigned = await pool.query(
        "SELECT 1 FROM school_students WHERE school_owner_id=$1 AND class_name=$2 AND stream=ANY($3::text[]) LIMIT 1",
        [x.schoolId, existing.rows[0].name, removed],
      );
      if (assigned.rowCount)
        return c.json({ error: "A stream with assigned students cannot be removed." }, 409);
    }
    const fee = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    const optional = (v: unknown) => (v === null || v === undefined || v === "" ? null : fee(v));
    const overrides =
      typeof b?.streamFees === "object" && b.streamFees !== null
        ? (b.streamFees as Record<string, Record<string, unknown>>)
        : {};
    const clean: Record<string, unknown> = {};
    for (const stream of streams) {
      const v = overrides[stream] || {};
      clean[stream] = {
        term1Fee: optional(v.term1Fee),
        term2Fee: optional(v.term2Fee),
        term3Fee: optional(v.term3Fee),
        extraFee: optional(v.extraFee),
      };
    }
    const r = await pool.query(
      `UPDATE school_classes SET streams=$3::jsonb,subjects=$4::jsonb,term_fee=$5,term1_fee=$5,term2_fee=$6,term3_fee=$7,extra_fee=$8,stream_fees=$9::jsonb WHERE id=$1 AND school_owner_id=$2 RETURNING id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees"`,
      [
        c.req.param("id"),
        x.schoolId,
        JSON.stringify(streams),
        JSON.stringify(subjects),
        fee(b?.term1Fee),
        fee(b?.term2Fee),
        fee(b?.term3Fee),
        fee(b?.extraFee),
        JSON.stringify(clean),
      ],
    );
    return c.json(r.rows[0]);
  });
  app.delete("/api/classes/:id", async (c) => {
    const x = await guard(c, "edit_classes");
    if (!x) return c.json({ error: "Not allowed." }, 403);
    const r = await pool.query(
      "DELETE FROM school_classes c WHERE c.id=$1 AND c.school_owner_id=$2 AND NOT EXISTS(SELECT 1 FROM school_students s WHERE s.school_owner_id=c.school_owner_id AND s.class_name=c.name) RETURNING c.id",
      [c.req.param("id"), x.schoolId],
    );
    if (!r.rowCount)
      return c.json({ error: "Class not found or students are still assigned to it." }, 409);
    return c.json({ ok: true });
  });
  app.get("/api/announcements", async (c) => {
    const x = await guard(c, "view_announcements");
    if (!x) return c.json({ error: "Not allowed to view announcements." }, 403);
    await pool.query(
      "DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",
      [x.schoolId],
    );
    return c.json(
      (
        await pool.query(
          'SELECT id,title,body,author_name AS "authorName",created_at AS "createdAt",expires_at AS "expiresAt" FROM school_announcements WHERE school_owner_id=$1 AND expires_at>now() ORDER BY created_at DESC',
          [x.schoolId],
        )
      ).rows,
    );
  });
  app.post("/api/announcements", async (c) => {
    const x = await guard(c, "manage_announcements");
    if (!x) return c.json({ error: "You do not have permission to create announcements." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      typeof b?.title !== "string" ||
      !b.title.trim() ||
      typeof b.body !== "string" ||
      !b.body.trim()
    )
      return c.json({ error: "Title and announcement are required." }, 400);
    const expiry = new Date(String(b.expiresAt || ""));
    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date())
      return c.json({ error: "Choose a future expiry date." }, 400);
    const r = await pool.query(
      'INSERT INTO school_announcements (school_owner_id,title,body,author_user_id,author_name,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,title,body,author_name AS "authorName",created_at AS "createdAt",expires_at AS "expiresAt"',
      [x.schoolId, b.title.trim(), b.body.trim(), c.get("userId"), x.name, expiry.toISOString()],
    );
    return c.json(r.rows[0], 201);
  });
  app.delete("/api/announcements/:id", async (c) => {
    const x = await guard(c, "manage_announcements");
    if (!x) return c.json({ error: "You do not have permission to delete announcements." }, 403);
    await pool.query("DELETE FROM school_announcements WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    return c.json({ ok: true });
  });

  app.get("/api/exams", async (c) => {
    const x = await guard(c, "view_exams");
    if (!x) return c.json({ error: "Not allowed to view exams." }, 403);
    const r = await pool.query(
      `SELECT e.id,e.name,e.class_name AS "className",e.stream,e.term,e.academic_year AS "academicYear",e.created_at AS "createdAt",e.starts_on AS "startsOn",e.ends_on AS "endsOn",(SELECT subjects FROM school_classes WHERE school_owner_id=e.school_owner_id AND name=e.class_name) AS subjects,count(m.id) FILTER(WHERE m.status='Pending') AS pending FROM school_exams e LEFT JOIN school_marks m ON m.exam_id=e.id WHERE e.school_owner_id=$1 AND ($2='Admin' OR EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=e.school_owner_id AND a.user_id=$3 AND c.name=e.class_name AND (a.stream=e.stream OR e.stream='*'))) GROUP BY e.id ORDER BY e.created_at DESC`,
      [x.schoolId, x.role, c.get("userId")],
    );
    return c.json(r.rows);
  });
  app.post("/api/exams", async (c) => {
    const x = await guard(c, "edit_exams");
    if (!x) return c.json({ error: "Not allowed to create exams." }, 403);
    if (x.role !== "Admin") return c.json({ error: "Only administrators can create exams." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      typeof b?.name !== "string" ||
      typeof b.className !== "string" ||
      typeof b.startsOn !== "string" ||
      typeof b.endsOn !== "string" ||
      b.endsOn < b.startsOn ||
      typeof b.academicYear !== "string" ||
      !/^20\d{2}$/.test(b.academicYear)
    )
      return c.json({ error: "Exam name, class, and valid dates are required." }, 400);
    const stream = String(b.stream || "");
    const cls = await pool.query(
      "SELECT subjects,streams FROM school_classes WHERE school_owner_id=$1 AND name=$2",
      [x.schoolId, b.className],
    );
    if (!cls.rowCount || (stream !== "*" && !(cls.rows[0].streams as string[]).includes(stream)))
      return c.json({ error: "Choose a class and stream configured in this school." }, 400);
    const result = await pool.query(
      "INSERT INTO school_exams(school_owner_id,name,class_name,stream,term,academic_year,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [
        x.schoolId,
        b.name.trim(),
        b.className,
        stream,
        String(b.term || ""),
        b.academicYear,
        b.startsOn,
        b.endsOn,
      ],
    );
    const id = result.rows[0].id;
    await pool.query(
      `INSERT INTO school_marks(school_owner_id,exam_id,student_id,subject,score,entered_by) SELECT $1,$2,s.id,sub.value,0,$3 FROM school_students s CROSS JOIN LATERAL jsonb_array_elements_text($4::jsonb) AS sub(value) WHERE s.school_owner_id=$1 AND s.class_name=$5 AND ($6='*' OR s.stream=$6) AND s.status='Active' ON CONFLICT(exam_id,student_id,subject) DO NOTHING`,
      [
        x.schoolId,
        id,
        c.get("userId"),
        JSON.stringify(cls.rows[0].subjects || []),
        b.className,
        stream,
      ],
    );
    return c.json({ id }, 201);
  });
  app.delete("/api/exams/:id", async (c) => {
    const x = await guard(c, "edit_exams");
    if (!x) return c.json({ error: "Not allowed to delete exams." }, 403);
    if (x.role !== "Admin") return c.json({ error: "Only administrators can delete exams." }, 403);
    const result = await pool.query(
      "DELETE FROM school_exams WHERE id=$1 AND school_owner_id=$2 RETURNING id",
      [c.req.param("id"), x.schoolId],
    );
    if (!result.rowCount) return c.json({ error: "Exam not found." }, 404);
    return c.json({ ok: true });
  });
  app.get("/api/exams/:id/marks", async (c) => {
    const x = await guard(c, "view_exams");
    if (!x) return c.json({ error: "Not allowed." }, 403);
    const r = await pool.query(
      `SELECT m.id,m.student_id AS "studentId",s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id AND s.school_owner_id=m.school_owner_id JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.exam_id=$1 AND m.school_owner_id=$2 AND ($3='Admin' OR EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$4 AND c.name=e.class_name AND a.stream=s.stream AND a.subjects ? m.subject)) ORDER BY s.last_name,s.first_name,m.subject`,
      [c.req.param("id"), x.schoolId, x.role, c.get("userId")],
    );
    return c.json(r.rows);
  });
  app.patch("/api/marks/:id", async (c) => {
    const x = await guard(c, "edit_exams");
    if (!x) return c.json({ error: "Not allowed to edit marks." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const score = Number(b?.score);
    const status = b?.status;
    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !["Pending", "Approved", "Denied"].includes(String(status))
    )
      return c.json({ error: "Score must be between 0 and 100 and status must be valid." }, 400);
    if (x.role !== "Admin" && status !== "Pending")
      return c.json({ error: "Only administrators can approve or deny marks." }, 403);
    const r = await pool.query(
      `UPDATE school_marks m SET score=$3,status=$4 FROM school_exams e,school_students s WHERE m.id=$1 AND m.school_owner_id=$2 AND e.id=m.exam_id AND e.school_owner_id=m.school_owner_id AND s.id=m.student_id AND s.school_owner_id=m.school_owner_id AND (e.stream='*' OR e.stream=s.stream) AND ($5='Admin' OR ($4='Pending' AND EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$6 AND c.name=e.class_name AND a.stream=s.stream AND a.subjects ? m.subject))) RETURNING m.id`,
      [c.req.param("id"), x.schoolId, score, status, x.role, c.get("userId")],
    );
    if (!r.rowCount) return c.json({ error: "Mark not found or outside your assignment." }, 404);
    return c.json(
      (
        await pool.query(
          "SELECT m.id,s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id WHERE m.id=$1 AND m.school_owner_id=$2",
          [c.req.param("id"), x.schoolId],
        )
      ).rows[0],
    );
  });
  app.patch("/api/exams/:id/marks", async (c) => {
    const x = await guard(c, "edit_exams");
    if (!x) return c.json({ error: "Not allowed to edit marks." }, 403);
    const body = (await c.req.json().catch(() => null)) as { marks?: unknown } | null;
    const entries = Array.isArray(body?.marks) ? body.marks : [];
    if (!entries.length || entries.length > 1000)
      return c.json({ error: "Enter at least one mark to save." }, 400);
    const normalized = entries.map((item) => {
      const row = item as Record<string, unknown>;
      return { id: String(row.id || ""), score: Number(row.score) };
    });
    if (
      normalized.some(
        (row) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            row.id,
          ) ||
          !Number.isFinite(row.score) ||
          row.score < 0 ||
          row.score > 100,
      ) ||
      new Set(normalized.map((row) => row.id)).size !== normalized.length
    )
      return c.json({ error: "Every score must be between 0 and 100." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exam = await client.query(
        'SELECT id,class_name AS "className",stream FROM school_exams WHERE id=$1 AND school_owner_id=$2 FOR UPDATE',
        [c.req.param("id"), x.schoolId],
      );
      if (!exam.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Exam not found." }, 404);
      }
      const saved = [];
      for (const mark of normalized) {
        const updated = await client.query(
          `UPDATE school_marks m SET score=$3,status='Pending' FROM school_students s
           WHERE m.id=$1 AND m.exam_id=$2 AND m.school_owner_id=$4 AND s.id=m.student_id AND s.school_owner_id=m.school_owner_id
             AND ($5='Admin' OR EXISTS(
               SELECT 1 FROM school_teacher_assignments a JOIN school_classes cl ON cl.id=a.class_id
               WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$6 AND cl.name=$7 AND a.stream=s.stream
                 AND a.subjects ? m.subject AND ($8='*' OR $8=s.stream)
             )) RETURNING m.id,m.student_id AS \"studentId\",s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status`,
          [
            mark.id,
            exam.rows[0].id,
            mark.score,
            x.schoolId,
            x.role,
            c.get("userId"),
            exam.rows[0].className,
            exam.rows[0].stream,
          ],
        );
        if (!updated.rowCount) {
          await client.query("ROLLBACK");
          return c.json(
            {
              error:
                "One or more marks are outside your assigned class, stream, or subjects. No marks were saved.",
            },
            404,
          );
        }
        saved.push(updated.rows[0]);
      }
      await client.query("COMMIT");
      return c.json({ saved });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.post("/api/exams/:id/approve-pending", async (c) => {
    const x = await guard(c, "edit_exams");
    if (!x) return c.json({ error: "Not allowed." }, 403);
    if (x.role !== "Admin") return c.json({ error: "Only administrators can approve marks." }, 403);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exam = await client.query(
        "SELECT id FROM school_exams WHERE id=$1 AND school_owner_id=$2 FOR UPDATE",
        [c.req.param("id"), x.schoolId],
      );
      if (!exam.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Exam not found." }, 404);
      }
      const r = await client.query(
        "UPDATE school_marks SET status='Approved' WHERE exam_id=$1 AND school_owner_id=$2 AND status='Pending' RETURNING id",
        [c.req.param("id"), x.schoolId],
      );
      await client.query("COMMIT");
      return c.json({ approved: r.rowCount || 0 });
    } catch {
      await client.query("ROLLBACK");
      return c.json({ error: "Could not approve pending marks." }, 400);
    } finally {
      client.release();
    }
  });
  app.get("/api/notifications/pending-marks", async (c) => {
    const context = await guard(c, "view_exams");
    if (!context) return c.json({ error: "Not allowed to view exam notifications." }, 403);
    if (context.role !== "Admin") return c.json({ count: 0 });
    const pending = await pool.query(
      "SELECT count(*)::int AS count FROM school_marks WHERE school_owner_id=$1 AND status='Pending'",
      [context.schoolId],
    );
    return c.json({ count: Number(pending.rows[0]?.count || 0) });
  });
  app.get("/api/exams/:id/report", async (c) => {
    const x = await guard(c, "view_exams");
    if (!x) return c.json({ error: "Not allowed." }, 403);
    if (x.role !== "Admin")
      return c.json({ error: "Only administrators can view ranked reports." }, 403);
    const meta = await pool.query(
      `SELECT e.name,e.class_name AS "className",e.stream,e.term,e.academic_year AS "academicYear",p.school_name AS "schoolName",p.motto,p.contact_email AS "schoolEmail",p.phone AS "schoolPhone",p.address AS "schoolAddress",p.logo_key AS "logoKey",cl.subjects FROM school_exams e JOIN school_profiles p ON p.user_id=e.school_owner_id JOIN school_classes cl ON cl.school_owner_id=e.school_owner_id AND cl.name=e.class_name WHERE e.id=$1 AND e.school_owner_id=$2`,
      [c.req.param("id"), x.schoolId],
    );
    if (!meta.rowCount) return c.json({ error: "Exam not found." }, 404);
    const students = await pool.query(
      `WITH totals AS (SELECT s.id,s.admission_no AS adm,s.first_name||' '||s.last_name AS name,s.first_name AS first,s.last_name AS last,s.gender,s.date_of_birth AS dob,s.guardian,s.phone,s.class_name AS class,s.stream,s.photo_key AS "photoKey",(SELECT count(*) FROM school_attendance a WHERE a.student_id=s.id AND a.school_owner_id=s.school_owner_id AND a.status='Present') AS "attendancePresent",(SELECT count(*) FROM school_attendance a WHERE a.student_id=s.id AND a.school_owner_id=s.school_owner_id AND a.status='Absent') AS "attendanceAbsent",(SELECT count(*) FROM school_attendance a WHERE a.student_id=s.id AND a.school_owner_id=s.school_owner_id AND a.status='Late') AS "attendanceLate",COALESCE(sum(m.score) FILTER(WHERE m.status='Approved'),0) AS total,COALESCE(jsonb_object_agg(m.subject,m.score) FILTER(WHERE m.status='Approved'), '{}'::jsonb) AS marks FROM school_exams e JOIN school_students s ON s.school_owner_id=e.school_owner_id AND s.class_name=e.class_name AND (e.stream='*' OR s.stream=e.stream) AND s.status='Active' LEFT JOIN school_marks m ON m.exam_id=e.id AND m.student_id=s.id AND m.status='Approved' WHERE e.id=$1 AND e.school_owner_id=$2 GROUP BY s.id) SELECT *,DENSE_RANK() OVER(ORDER BY total DESC) AS position,count(*) OVER() AS "classSize" FROM totals ORDER BY position,name`,
      [c.req.param("id"), x.schoolId],
    );
    const logoUrl = meta.rows[0].logoKey
      ? await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: imageBucket, Key: meta.rows[0].logoKey }),
          { expiresIn: 3600 },
        )
      : "";
    const cardStudents = await Promise.all(
      students.rows.map(async (student) => {
        const photoUrl = student.photoKey
          ? await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: imageBucket, Key: student.photoKey }),
              { expiresIn: 3600 },
            )
          : "";
        const { photoKey, ...details } = student;
        return { ...details, photoUrl };
      }),
    );
    return c.json({
      ...meta.rows[0],
      logoUrl,
      subjects: meta.rows[0].subjects || [],
      students: cardStudents,
    });
  });
  app.get("/api/students/:id/report-card", async (c) => {
    const x = await guard(c, "view_exams");
    if (!x) return c.json({ error: "Not allowed to view report cards." }, 403);
    if (x.role !== "Admin")
      return c.json({ error: "Only administrators can print report cards." }, 403);
    const student = await pool.query(
      `SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.gender,s.date_of_birth AS dob,s.class_name AS "class",s.stream,s.guardian,s.phone,s.address,s.admitted_on AS admitted,s.photo_key AS "photoKey",p.school_name AS "schoolName",p.motto,p.contact_email AS "schoolEmail",p.phone AS "schoolPhone",p.address AS "schoolAddress",p.logo_key AS "logoKey" FROM school_students s JOIN school_profiles p ON p.user_id=s.school_owner_id WHERE s.id=$1 AND s.school_owner_id=$2`,
      [c.req.param("id"), x.schoolId],
    );
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const photoUrl = student.rows[0].photoKey
      ? await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: imageBucket, Key: student.rows[0].photoKey }),
          { expiresIn: 3600 },
        )
      : "";
    const logoUrl = student.rows[0].logoKey
      ? await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: imageBucket, Key: student.rows[0].logoKey }),
          { expiresIn: 3600 },
        )
      : "";
    const attendance = await pool.query(
      `SELECT count(*) FILTER(WHERE status='Present') AS present,count(*) FILTER(WHERE status='Absent') AS absent,count(*) FILTER(WHERE status='Late') AS late FROM school_attendance WHERE student_id=$1 AND school_owner_id=$2`,
      [c.req.param("id"), x.schoolId],
    );
    const rows = await pool.query(
      `SELECT e.id,e.name AS exam,e.term,e.academic_year AS "academicYear",m.subject,m.score FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.student_id=$1 AND m.school_owner_id=$2 AND m.status='Approved' AND ($3='' OR e.term=$3) AND ($4='' OR e.academic_year::text=$4) ORDER BY e.academic_year,e.created_at,m.subject`,
      [c.req.param("id"), x.schoolId, c.req.query("term") || "", c.req.query("year") || ""],
    );
    type StudentExam = {
      id: string;
      exam: string;
      term: string;
      academicYear: string;
      marks: { subject: string; score: number }[];
      total: number;
      position: number;
      classSize: number;
    };
    const exams = new Map<string, StudentExam>();
    for (const r of rows.rows) {
      const id = String(r.id);
      if (!exams.has(id))
        exams.set(id, {
          id,
          exam: r.exam,
          term: r.term,
          academicYear: r.academicYear,
          marks: [],
          total: 0,
          position: 0,
          classSize: 0,
        });
      const exam = exams.get(id);
      if (!exam) continue;
      exam.marks.push({ subject: r.subject, score: Number(r.score) });
      exam.total += Number(r.score);
    }
    for (const e of exams.values()) {
      const rank = await pool.query(
        `WITH totals AS (SELECT s.id,COALESCE(sum(m.score) FILTER(WHERE m.status='Approved'),0) AS total FROM school_exams ex JOIN school_students s ON s.school_owner_id=ex.school_owner_id AND s.class_name=ex.class_name AND (ex.stream='*' OR s.stream=ex.stream) AND s.status='Active' LEFT JOIN school_marks m ON m.exam_id=ex.id AND m.student_id=s.id WHERE ex.id=$1 AND ex.school_owner_id=$2 GROUP BY s.id), ranked AS (SELECT DENSE_RANK() OVER(ORDER BY total DESC) AS position,count(*) OVER() AS "classSize",id FROM totals) SELECT position,"classSize" FROM ranked WHERE id=$3`,
        [e.id, x.schoolId, c.req.param("id")],
      );
      e.position = Number(rank.rows[0]?.position || 0);
      e.classSize = Number(rank.rows[0]?.classSize || 0);
    }
    const terms = await pool.query(
      `SELECT e.term,e.academic_year AS "academicYear",sum(m.score) AS total FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.student_id=$1 AND m.school_owner_id=$2 AND m.status='Approved' GROUP BY e.term,e.academic_year ORDER BY e.academic_year,e.term`,
      [c.req.param("id"), x.schoolId],
    );
    const cardStudent = { ...student.rows[0], photoUrl, logoUrl };
    delete (cardStudent as Record<string, unknown>).photoKey;
    delete (cardStudent as Record<string, unknown>).logoKey;
    return c.json({
      student: cardStudent,
      attendance: attendance.rows[0],
      marks: [...exams.values()].flatMap((e) =>
        e.marks.map((m) => ({
          ...m,
          exam: e.exam,
          term: e.term,
          academicYear: e.academicYear,
          position: e.position,
          classSize: e.classSize,
          total: e.total,
          schoolName: student.rows[0].schoolName,
        })),
      ),
    });
  });
  app.get("/api/events", async (c) => {
    const x = await guard(c, "view_announcements");
    if (!x) return c.json({ error: "Not allowed to view school events." }, 403);
    return c.json(
      (
        await pool.query(
          `SELECT id,title,details,location,starts_at AS "startsAt",author_name AS "authorName" FROM school_events WHERE school_owner_id=$1 AND starts_at>=now() ORDER BY starts_at LIMIT 20`,
          [x.schoolId],
        )
      ).rows,
    );
  });
  app.post("/api/events", async (c) => {
    const x = await guard(c, "manage_announcements");
    if (!x) return c.json({ error: "Not allowed to create school events." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const startsAt = new Date(String(b?.startsAt || ""));
    if (
      typeof b?.title !== "string" ||
      !b.title.trim() ||
      !Number.isFinite(startsAt.getTime()) ||
      startsAt <= new Date()
    )
      return c.json({ error: "Event title and a future date and time are required." }, 400);
    const r = await pool.query(
      `INSERT INTO school_events(school_owner_id,title,details,location,starts_at,author_user_id,author_name) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,details,location,starts_at AS "startsAt",author_name AS "authorName"`,
      [
        x.schoolId,
        b.title.trim(),
        String(b.details || "").trim(),
        String(b.location || "").trim(),
        startsAt.toISOString(),
        c.get("userId"),
        x.name,
      ],
    );
    return c.json(r.rows[0], 201);
  });
  app.delete("/api/events/:id", async (c) => {
    const x = await guard(c, "manage_announcements");
    if (!x) return c.json({ error: "Not allowed to delete school events." }, 403);
    await pool.query("DELETE FROM school_events WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    return c.json({ ok: true });
  });
  const planPrices: Record<string, number> = {
    Starter: 1500,
    Basic: 3000,
    Standard: 5000,
    Premium: 8000,
    Enterprise: 0,
  };
  app.get("/api/billing", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to manage billing." }, 403);
    const result = await pool.query(
      `SELECT p.billing_plan AS plan,p.billing_cycle AS cycle,p.platform_status AS status,p.trial_started_at AS "trialStartedAt",p.subscription_expires_at AS "expiresAt",p.grace_ends_at AS "graceEndsAt",
        (SELECT count(*)::int FROM school_students s WHERE s.school_owner_id=p.user_id AND s.status='Active') AS "studentCount",
        EXISTS(SELECT 1 FROM school_billing_payments b WHERE b.school_owner_id=p.user_id AND b.status='confirmed') AS "hasPaidSubscription",
        COALESCE((SELECT json_agg(json_build_object('id',i.id,'number',i.invoice_number,'plan',i.plan,'cycle',i.cycle,'studentCount',i.student_count,'amount',i.amount,'status',i.status,'issuedAt',i.issued_at,'dueAt',i.due_at) ORDER BY i.issued_at DESC) FROM school_billing_invoices i WHERE i.school_owner_id=p.user_id),'[]'::json) AS invoices,
        COALESCE((SELECT json_agg(json_build_object('id',b.id,'amount',b.amount,'method',b.method,'reference',COALESCE(NULLIF(b.mpesa_receipt,''),b.reference),'paidAt',b.paid_at,'status',b.status) ORDER BY b.paid_at DESC) FROM school_billing_payments b WHERE b.school_owner_id=p.user_id),'[]'::json) AS payments
       FROM school_profiles p WHERE p.user_id=$1`,
      [context.schoolId],
    );
    return c.json({ ...result.rows[0], planPrices });
  });
  app.get("/api/billing/status", async (c) => {
    const context = await contextFor(c);
    if (!context) return c.json({ error: "Sign in to continue." }, 403);
    const result = await pool.query(
      "SELECT platform_status AS status,subscription_expires_at AS \"expiresAt\" FROM school_profiles WHERE user_id=$1",
      [context.schoolId],
    );
    const row = result.rows[0];
    const expired = row?.status === "suspended" || (row?.expiresAt && new Date(row.expiresAt) < new Date());
    return c.json({ locked: Boolean(expired), expiresAt: row?.expiresAt || null });
  });
  app.post("/api/billing/invoices", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to create an invoice." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const plan = String(body?.plan || ""),
      cycle = String(body?.cycle || "");
    if (!(plan in planPrices) || !["monthly", "termly", "annual"].includes(cycle))
      return c.json({ error: "Choose a valid subscription plan and billing cycle." }, 400);
    const count = await pool.query(
      "SELECT count(*)::int AS n FROM school_students WHERE school_owner_id=$1 AND status='Active'",
      [context.schoolId],
    );
    const students = Number(count.rows[0].n);
    const resolvedPlan =
      students > 1000
        ? "Enterprise"
        : students > 600
          ? "Premium"
          : students > 300
            ? "Standard"
            : students > 100
              ? "Basic"
              : "Starter";
    if (resolvedPlan === "Enterprise")
      return c.json(
        { error: "Enterprise pricing is custom. Contact Shule Yetu to issue an invoice." },
        400,
      );
    const amount =
      (planPrices[resolvedPlan] ?? 0) * (cycle === "termly" ? 3 : cycle === "annual" ? 10 : 1);
    const invoice = await pool.query(
      `INSERT INTO school_billing_invoices(school_owner_id,invoice_number,plan,cycle,student_count,amount,due_at)
       VALUES($1,'SY-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),$2,$3,$4,$5,now()+interval '7 days')
       RETURNING id,invoice_number AS number,plan,cycle,student_count AS "studentCount",amount,status,issued_at AS "issuedAt",due_at AS "dueAt"`,
      [context.schoolId, resolvedPlan, cycle, students, amount],
    );
    await pool.query(
      "UPDATE school_profiles SET billing_plan=$2,billing_cycle=$3 WHERE user_id=$1",
      [context.schoolId, resolvedPlan, cycle],
    );
    return c.json(invoice.rows[0], 201);
  });
  app.post("/api/billing/invoices/:id/pay", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to record a subscription payment." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const reference = String(body?.reference || "").trim();
    const method = String(body?.method || "");
    if (!reference || !["M-Pesa", "Bank", "Cash"].includes(method))
      return c.json({ error: "Enter a payment reference and choose M-Pesa, bank, or cash." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const invoice = await client.query(
        "SELECT * FROM school_billing_invoices WHERE id=$1 AND school_owner_id=$2 AND status='due' FOR UPDATE",
        [c.req.param("id"), context.schoolId],
      );
      if (!invoice.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Due invoice not found." }, 404);
      }
      const row = invoice.rows[0];
      await client.query(
        "INSERT INTO school_billing_payments(school_owner_id,invoice_id,amount,method,reference,paid_at) VALUES($1,$2,$3,$4,$5,NULL)",
        [context.schoolId, row.id, row.amount, method, reference],
      );
      await client.query("COMMIT");
      return c.json({ ok: true, status: "pending" });
    } catch {
      await client.query("ROLLBACK");
      return c.json({ error: "Could not save payment." }, 400);
    } finally {
      client.release();
    }
  });
  app.post("/api/billing/invoices/:id/stk-push", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context || context.role !== "Admin")
      return c.json({ error: "Only a school administrator can pay the subscription." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const rawPhone = String(body?.phone || "").replace(/[\s()-]/g, "");
    const phone = rawPhone.startsWith("0") ? `254${rawPhone.slice(1)}` : rawPhone.replace(/^\+/, "");
    if (!/^254[17]\d{8}$/.test(phone))
      return c.json({ error: "Enter a valid Kenyan M-Pesa number." }, 400);
    const invoice = await pool.query(
      "SELECT id,invoice_number,amount,cycle FROM school_billing_invoices WHERE id=$1 AND school_owner_id=$2 AND status='due'",
      [c.req.param("id"), context.schoolId],
    );
    if (!invoice.rowCount) return c.json({ error: "Due invoice not found." }, 404);
    const row = invoice.rows[0];
    const pending = await pool.query(
      "SELECT 1 FROM school_billing_payments WHERE invoice_id=$1 AND status='pending' LIMIT 1",
      [row.id],
    );
    if (pending.rowCount) return c.json({ error: "An STK payment is already pending for this invoice." }, 409);
    const payment = await pool.query(
      "INSERT INTO school_billing_payments(school_owner_id,invoice_id,amount,method,reference,paid_at) VALUES($1,$2,$3,'M-Pesa STK',$4,NULL) RETURNING id",
      [context.schoolId, row.id, row.amount, `starting:${randomUUID()}`],
    );
    try {
      const stk = await startDarajaStkPush(phone, Number(row.amount), row.invoice_number, "School subscription");
      await pool.query(
        "UPDATE school_billing_payments SET reference=$2 WHERE id=$1",
        [payment.rows[0].id, stk.checkoutRequestId],
      );
      return c.json({ message: stk.message, amount: Number(row.amount) }, 202);
    } catch (error) {
      await pool.query("UPDATE school_billing_payments SET status='rejected' WHERE id=$1", [payment.rows[0].id]);
      return c.json({ error: error instanceof Error ? error.message : "Could not start M-Pesa payment." }, 502);
    }
  });
  app.get("/api/sms", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Only administrators can manage SMS." }, 403);
    const [wallet, transactions] = await Promise.all([
      pool.query("SELECT credits FROM school_sms_wallets WHERE school_owner_id=$1", [
        context.schoolId,
      ]),
      pool.query(
        `SELECT id,transaction_type AS type,quantity,amount,status,phone_number AS "phoneNumber",mpesa_receipt AS "receipt",created_at AS "createdAt" FROM school_sms_transactions WHERE school_owner_id=$1 ORDER BY created_at DESC LIMIT 50`,
        [context.schoolId],
      ),
    ]);
    const darajaConfigured = Boolean(
      process.env.DARAJA_CONSUMER_KEY &&
      process.env.DARAJA_CONSUMER_SECRET &&
      process.env.DARAJA_SHORTCODE &&
      process.env.DARAJA_PASSKEY &&
      process.env.DARAJA_CALLBACK_URL,
    );
    const olympusConfigured = Boolean(
      process.env.OLYMPUS_SMS_API_URL &&
      process.env.OLYMPUS_SMS_API_KEY &&
      process.env.OLYMPUS_SMS_SENDER_ID,
    );
    return c.json({
      credits: Number(wallet.rows[0]?.credits || 0),
      pricePerSms: 1,
      transactions: transactions.rows,
      darajaConfigured,
      olympusConfigured,
    });
  });
  app.post("/api/sms/topups", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context || context.role !== "Admin")
      return c.json({ error: "Only a school administrator can purchase SMS credits." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const quantity = Number(body?.quantity);
    const phoneInput = String(body?.phone || "").replace(/[\s()-]/g, "");
    const phone = phoneInput.startsWith("0")
      ? `254${phoneInput.slice(1)}`
      : phoneInput.startsWith("+")
        ? phoneInput.slice(1)
        : phoneInput;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000)
      return c.json({ error: "Choose a whole number of SMS credits from 1 to 100,000." }, 400);
    if (!/^254[17]\d{8}$/.test(phone))
      return c.json(
        { error: "Enter a valid Kenyan M-Pesa number, for example 07… or 2547…." },
        400,
      );
    const required = [
      "DARAJA_CONSUMER_KEY",
      "DARAJA_CONSUMER_SECRET",
      "DARAJA_SHORTCODE",
      "DARAJA_PASSKEY",
      "DARAJA_CALLBACK_URL",
    ];
    if (required.some((key) => !process.env[key]))
      return c.json({ error: "M-Pesa checkout is not configured for this app yet." }, 503);
    const client = await pool.connect();
    let transactionId = "";
    try {
      await client.query("BEGIN");
      const transaction = await client.query(
        `INSERT INTO school_sms_transactions(school_owner_id,transaction_type,quantity,amount,phone_number)
         VALUES($1,'purchase',$2,$2,$3) RETURNING id`,
        [context.schoolId, quantity, phone],
      );
      transactionId = transaction.rows[0].id;
      await client.query("COMMIT");

      const environment =
        process.env.DARAJA_ENVIRONMENT === "production" ? "production" : "sandbox";
      const apiHost =
        environment === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";
      const credentials = Buffer.from(
        `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`,
      ).toString("base64");
      const tokenResponse = await fetch(
        `${apiHost}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${credentials}` } },
      );
      const tokenBody = (await tokenResponse.json().catch(() => ({}))) as {
        access_token?: string;
      };
      if (!tokenResponse.ok || !tokenBody.access_token)
        throw new Error("Could not authenticate with M-Pesa Daraja.");

      const dateParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const part = (type: string) => dateParts.find((item) => item.type === type)?.value || "00";
      const timestamp = `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
      const shortcode = process.env.DARAJA_SHORTCODE!;
      const password = Buffer.from(
        `${shortcode}${process.env.DARAJA_PASSKEY}${timestamp}`,
      ).toString("base64");
      const stkResponse = await fetch(`${apiHost}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline",
          Amount: quantity,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: process.env.DARAJA_CALLBACK_URL,
          AccountReference: "ShuleYetuSMS",
          TransactionDesc: `${quantity} SMS credits`,
        }),
      });
      const stkBody = (await stkResponse.json().catch(() => ({}))) as {
        errorMessage?: string;
        CustomerMessage?: string;
        CheckoutRequestID?: string;
        ResponseCode?: string;
      };
      if (!stkResponse.ok || stkBody.ResponseCode !== "0" || !stkBody.CheckoutRequestID)
        throw new Error(
          stkBody.errorMessage || stkBody.CustomerMessage || "M-Pesa STK Push failed.",
        );
      await pool.query(
        "UPDATE school_sms_transactions SET checkout_request_id=$2,details=jsonb_build_object('merchantRequestId',$3) WHERE id=$1",
        [
          transactionId,
          stkBody.CheckoutRequestID,
          (stkBody as Record<string, unknown>).MerchantRequestID || "",
        ],
      );
      return c.json(
        {
          transactionId,
          checkoutRequestId: stkBody.CheckoutRequestID,
          message: stkBody.CustomerMessage || "Approve the M-Pesa request on your phone.",
        },
        202,
      );
    } catch (error) {
      await pool.query(
        "UPDATE school_sms_transactions SET status='failed',details=jsonb_build_object('error',$2) WHERE id=$1 AND status='pending'",
        [transactionId, error instanceof Error ? error.message : "STK push failed"],
      );
      return c.json(
        { error: error instanceof Error ? error.message : "Could not start M-Pesa checkout." },
        502,
      );
    } finally {
      client.release();
    }
  });
  app.post("/api/sms/mpesa/callback", async (c) => {
    const callback = (await c.req.json().catch(() => null)) as {
      Body?: { stkCallback?: Record<string, unknown> };
    } | null;
    const result = callback?.Body?.stkCallback;
    const checkoutId = String(result?.CheckoutRequestID || "");
    const resultCode = Number(result?.ResultCode);
    if (!checkoutId || !Number.isInteger(resultCode))
      return c.json({ ResultCode: 1, ResultDesc: "Invalid callback payload" }, 400);
    const meta = result?.CallbackMetadata as
      { Item?: { Name?: string; Value?: unknown }[] } | undefined;
    const values = Object.fromEntries((meta?.Item || []).map((item) => [item.Name, item.Value]));
    const receipt = String(values.MpesaReceiptNumber || "");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const transaction = await client.query(
        "SELECT id,school_owner_id,quantity,amount,status FROM school_sms_transactions WHERE checkout_request_id=$1 FOR UPDATE",
        [checkoutId],
      );
      if (transaction.rowCount && transaction.rows[0].status === "pending") {
        const row = transaction.rows[0];
        if (resultCode === 0 && Number(values.Amount) === Number(row.amount) && receipt) {
          await client.query(
            "INSERT INTO school_sms_wallets(school_owner_id,credits) VALUES($1,$2) ON CONFLICT(school_owner_id) DO UPDATE SET credits=school_sms_wallets.credits+EXCLUDED.credits,updated_at=now()",
            [row.school_owner_id, row.quantity],
          );
          await client.query(
            "UPDATE school_sms_transactions SET status='confirmed',mpesa_receipt=$2,completed_at=now(),details=details||$3::jsonb WHERE id=$1",
            [row.id, receipt, JSON.stringify({ phoneNumber: values.PhoneNumber || null })],
          );
        } else {
          await client.query(
            "UPDATE school_sms_transactions SET status='failed',completed_at=now(),details=details||$2::jsonb WHERE id=$1",
            [
              row.id,
              JSON.stringify({
                resultCode,
                resultDescription: result?.ResultDesc || "Payment failed",
              }),
            ],
          );
        }
      } else if (!transaction.rowCount) {
        const payment = await client.query(
          "SELECT b.id,b.school_owner_id,b.invoice_id,b.amount,b.status,i.cycle FROM school_billing_payments b JOIN school_billing_invoices i ON i.id=b.invoice_id WHERE b.reference=$1 AND b.method='M-Pesa STK' FOR UPDATE OF b,i",
          [checkoutId],
        );
        if (payment.rowCount && payment.rows[0].status === "pending") {
          const row = payment.rows[0];
          if (resultCode === 0 && Number(values.Amount) === Number(row.amount) && receipt) {
            const duration = row.cycle === "annual" ? "12 months" : row.cycle === "termly" ? "3 months" : "1 month";
            await client.query(
              "UPDATE school_billing_payments SET status='confirmed',mpesa_receipt=$2,paid_at=now() WHERE id=$1",
              [row.id, receipt],
            );
            await client.query(
              "UPDATE school_billing_invoices SET status='paid',paid_at=now() WHERE id=$1",
              [row.invoice_id],
            );
            await client.query(
              "UPDATE school_profiles SET platform_status='active',subscription_expires_at=GREATEST(COALESCE(subscription_expires_at,now()),now())+$2::interval,grace_ends_at=NULL WHERE user_id=$1",
              [row.school_owner_id, duration],
            );
          } else {
            await client.query(
              "UPDATE school_billing_payments SET status='rejected',mpesa_receipt=$2 WHERE id=$1",
              [row.id, receipt],
            );
          }
        }
      }
      await client.query("COMMIT");
      return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("SMS M-Pesa callback failed", error);
      return c.json({ ResultCode: 1, ResultDesc: "Temporary processing error" }, 500);
    } finally {
      client.release();
    }
  });
  const platformAdmin = (c: HonoContext<ApiEnv>) =>
    String(process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .includes(
        String(c.get("userEmail") || "")
          .trim()
          .toLowerCase(),
      );
  app.get("/api/platform/access", async (c) => c.json({ allowed: platformAdmin(c) }));
  app.get("/api/platform/schools", async (c) => {
    if (!platformAdmin(c))
      return c.json(
        { error: "Platform super-admin access is not configured for this account." },
        403,
      );
    const schools = await pool.query(
      `SELECT p.user_id AS id,p.school_name AS name,p.contact_email AS email,p.phone,p.platform_status AS status,p.billing_plan AS plan,p.billing_cycle AS cycle,p.subscription_expires_at AS "subscriptionExpiresAt",
        (SELECT count(*)::int FROM school_students s WHERE s.school_owner_id=p.user_id AND s.status='Active') AS "activeStudents",
        (SELECT count(*)::int FROM school_staff a WHERE a.school_owner_id=p.user_id AND a.active) AS "activeStaff"
       FROM school_profiles p ORDER BY p.school_name`,
    );
    return c.json({ schools });
  });
  app.patch("/api/platform/schools/:id", async (c) => {
    if (!platformAdmin(c))
      return c.json(
        { error: "Platform super-admin access is not configured for this account." },
        403,
      );
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const status = String(body?.status || ""),
      plan = String(body?.plan || ""),
      extendDays = Number(body?.extendDays || 0);
    if (!["active", "suspended"].includes(status) && !(plan in planPrices) && !(Number.isInteger(extendDays) && extendDays >= 1 && extendDays <= 3650))
      return c.json({ error: "Choose a valid school status or plan." }, 400);
    const result = await pool.query(
      "UPDATE school_profiles SET platform_status=CASE WHEN $4::int>0 THEN 'active' ELSE COALESCE(NULLIF($2,''),platform_status) END,billing_plan=COALESCE(NULLIF($3,''),billing_plan),subscription_expires_at=CASE WHEN $4::int>0 THEN GREATEST(COALESCE(subscription_expires_at,now()),now())+($4::text||' days')::interval ELSE subscription_expires_at END WHERE user_id=$1 RETURNING user_id",
      [
        c.req.param("id"),
        ["active", "suspended"].includes(status) ? status : "",
        plan in planPrices ? plan : "",
        Number.isInteger(extendDays) && extendDays >= 1 && extendDays <= 3650 ? extendDays : 0,
      ],
    );
    if (!result.rowCount) return c.json({ error: "School not found." }, 404);
    return c.json({ ok: true });
  });
  app.get("/api/platform/payments", async (c) => {
    if (!platformAdmin(c))
      return c.json(
        { error: "Platform super-admin access is not configured for this account." },
        403,
      );
    const result = await pool.query(
      `SELECT b.id,b.school_owner_id AS "schoolId",p.school_name AS "schoolName",b.invoice_id AS "invoiceId",i.invoice_number AS "invoiceNumber",b.amount,b.method,b.reference,b.paid_at AS "paidAt" FROM school_billing_payments b JOIN school_profiles p ON p.user_id=b.school_owner_id LEFT JOIN school_billing_invoices i ON i.id=b.invoice_id WHERE b.status='pending' ORDER BY b.paid_at`,
    );
    return c.json({ payments: result.rows });
  });
  app.patch("/api/platform/payments/:id", async (c) => {
    if (!platformAdmin(c))
      return c.json(
        { error: "Platform super-admin access is not configured for this account." },
        403,
      );
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const decision = String(body?.decision || "");
    if (!["confirm", "reject"].includes(decision))
      return c.json({ error: "Choose confirm or reject." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await client.query(
        "SELECT b.id,b.school_owner_id,b.invoice_id,i.cycle FROM school_billing_payments b JOIN school_billing_invoices i ON i.id=b.invoice_id WHERE b.id=$1 AND b.status='pending' FOR UPDATE OF b,i",
        [c.req.param("id")],
      );
      if (!payment.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Pending payment not found." }, 404);
      }
      const row = payment.rows[0];
      await client.query(
        "UPDATE school_billing_payments SET status=$2,verified_by=$3,verified_at=now() WHERE id=$1",
        [row.id, decision === "confirm" ? "confirmed" : "rejected", c.get("userEmail")],
      );
      if (decision === "confirm") {
        const duration =
          row.cycle === "annual" ? "12 months" : row.cycle === "termly" ? "3 months" : "1 month";
        await client.query(
          "UPDATE school_billing_invoices SET status='paid',paid_at=now() WHERE id=$1",
          [row.invoice_id],
        );
        await client.query(
          "UPDATE school_profiles SET platform_status='active',subscription_expires_at=GREATEST(COALESCE(subscription_expires_at,now()),now())+$2::interval,grace_ends_at=NULL WHERE user_id=$1",
          [row.school_owner_id, duration],
        );
      }
      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch {
      await client.query("ROLLBACK");
      return c.json({ error: "Could not verify subscription payment." }, 400);
    } finally {
      client.release();
    }
  });

  app.get("/api/dashboard", async (c) => {
    const x = await guard(c, "view_students");
    if (!x) return c.json({ error: "Not allowed to view dashboard." }, 403);
    await pool.query(
      "DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",
      [x.schoolId],
    );
    const r = await pool.query(
      `SELECT (SELECT count(*) FROM school_students WHERE school_owner_id=sp.user_id AND status='Active') AS students,
        (SELECT count(*) FROM school_staff WHERE school_owner_id=sp.user_id AND active) AS staff,
        (SELECT COALESCE(sum(credit),0) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND entry_type='Payment') AS paid,
        (SELECT COALESCE(sum(debit-credit),0) FROM school_fee_entries WHERE school_owner_id=sp.user_id) AS balance,
        sp.active_term AS "activeTerm",sp.academic_year AS "academicYear",
        COALESCE((SELECT sum(debit) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND term=concat_ws(' ',sp.active_term,sp.academic_year)),0) AS "termBilled",
        LEAST(COALESCE((SELECT sum(debit) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND term=concat_ws(' ',sp.active_term,sp.academic_year)),0),COALESCE((SELECT sum(credit) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND entry_type='Payment' AND term=concat_ws(' ',sp.active_term,sp.academic_year)),0)) AS "termPaid",
        GREATEST(COALESCE((SELECT sum(debit) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND term=concat_ws(' ',sp.active_term,sp.academic_year)),0)-COALESCE((SELECT sum(credit) FROM school_fee_entries WHERE school_owner_id=sp.user_id AND entry_type='Payment' AND term=concat_ws(' ',sp.active_term,sp.academic_year)),0),0) AS "termUnpaid"
       FROM school_profiles sp WHERE sp.user_id=$1`,
      [x.schoolId],
    );
    return c.json(r.rows[0]);
  });

  // LMS staff routes are scoped to existing class/subject records. A teacher
  // can manage only an assigned class, stream, and subject combination.
  async function canManageLearning(
    context: SchoolContext,
    userId: string,
    classId: string,
    subject: string,
    stream: string,
  ) {
    const cl = await pool.query(
      "SELECT subjects, streams FROM school_classes WHERE id=$1 AND school_owner_id=$2",
      [classId, context.schoolId],
    );
    if (!cl.rowCount) return false;
    const subjects = cl.rows[0].subjects as string[];
    const streams = cl.rows[0].streams as string[];
    if (!subjects.includes(subject) || (stream !== "*" && !streams.includes(stream))) return false;
    if (context.role === "Admin") return true;
    const assignment = await pool.query(
      "SELECT 1 FROM school_teacher_assignments WHERE school_owner_id=$1 AND user_id=$2 AND class_id=$3 AND ($4='*' OR stream=$4) AND subjects ? $5 LIMIT 1",
      [context.schoolId, userId, classId, stream, subject],
    );
    return Boolean(assignment.rowCount);
  }

  async function canReadDiscussion(context: SchoolContext, userId: string, discussionId: string) {
    const allowed = await pool.query(
      `SELECT 1 FROM school_lms_discussions d JOIN school_classes c ON c.id=d.class_id AND c.school_owner_id=d.school_owner_id
       WHERE d.id=$1 AND d.school_owner_id=$2 AND (
         $3='Admin' OR
         ($3='Student' AND EXISTS(SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=d.school_owner_id AND s.class_name=c.name AND s.status='Active' AND c.subjects ? d.subject AND (d.stream='*' OR d.stream=s.stream))) OR
         ($3='Teacher' AND EXISTS(SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=d.school_owner_id AND a.user_id=$5 AND a.class_id=d.class_id AND (d.stream='*' OR a.stream=d.stream) AND a.subjects ? d.subject)))`,
      [discussionId, context.schoolId, context.role, context.studentId || null, userId],
    );
    return Boolean(allowed.rowCount);
  }

  app.get("/api/lms/discussions", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view learning discussions." }, 403);
    const result = await pool.query(
      `SELECT d.id,d.class_id AS "classId",cl.name AS "className",d.subject,d.title,d.body,
        d.author_user_id AS "authorUserId",d.author_name AS "authorName",d.created_at AS "createdAt",d.closed_at AS "closedAt",
        (SELECT count(*) FROM school_lms_discussion_replies r WHERE r.discussion_id=d.id) AS "replyCount"
       FROM school_lms_discussions d JOIN school_classes cl ON cl.id=d.class_id AND cl.school_owner_id=d.school_owner_id
       WHERE d.school_owner_id=$1 AND (
         $2='Admin' OR
         ($2='Student' AND EXISTS(SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=d.school_owner_id AND s.class_name=cl.name AND s.status='Active' AND cl.subjects ? d.subject AND (d.stream='*' OR d.stream=s.stream))) OR
         ($2='Teacher' AND EXISTS(SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=d.school_owner_id AND a.user_id=$3 AND a.class_id=d.class_id AND (d.stream='*' OR a.stream=d.stream) AND a.subjects ? d.subject)))
       ORDER BY d.created_at DESC LIMIT 100`,
      [context.schoolId, context.role, c.get("userId"), context.studentId || null],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/discussions", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context || !(context.studentId || context.role === "Admin" || context.role === "Teacher"))
      return c.json({ error: "Not allowed to start learning discussions." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(body?.classId || "");
    const subject = String(body?.subject || "").trim();
    const title = String(body?.title || "").trim();
    const message = String(body?.body || "").trim();
    let stream = String(body?.stream || "*");
    if (!classId || !subject || !title || title.length > 180 || !message || message.length > 5000)
      return c.json({ error: "Choose a class and subject and provide a title and message." }, 400);
    let allowed = false;
    if (context.studentId) {
      const audience = await pool.query(
        `SELECT s.stream FROM school_students s JOIN school_classes cl ON cl.school_owner_id=s.school_owner_id AND cl.name=s.class_name
         WHERE s.id=$1 AND s.school_owner_id=$2 AND s.status='Active' AND cl.id=$3 AND cl.subjects ? $4`,
        [context.studentId, context.schoolId, classId, subject],
      );
      allowed = Boolean(audience.rowCount);
      if (audience.rowCount) stream = audience.rows[0].stream;
    } else {
      if (context.role !== "Admin" && stream === "*")
        return c.json({ error: "Teachers must select one of their assigned streams." }, 403);
      allowed = await canManageLearning(context, c.get("userId"), classId, subject, stream);
    }
    if (!allowed) return c.json({ error: "You cannot post to this class and subject forum." }, 403);
    const result = await pool.query(
      `INSERT INTO school_lms_discussions(school_owner_id,class_id,subject,stream,title,body,author_user_id,author_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,class_id AS "classId",subject,stream,title,body,author_name AS "authorName",created_at AS "createdAt"`,
      [context.schoolId, classId, subject, stream, title, message, c.get("userId"), context.name],
    );
    return c.json(result.rows[0], 201);
  });

  app.get("/api/lms/discussions/:id/replies", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context || !(await canReadDiscussion(context, c.get("userId"), c.req.param("id"))))
      return c.json({ error: "Discussion not found." }, 404);
    const result = await pool.query(
      `SELECT id,body,author_name AS "authorName",created_at AS "createdAt" FROM school_lms_discussion_replies
       WHERE discussion_id=$1 AND school_owner_id=$2 ORDER BY created_at LIMIT 200`,
      [c.req.param("id"), context.schoolId],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/discussions/:id/replies", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context || !(context.studentId || context.role === "Admin" || context.role === "Teacher"))
      return c.json({ error: "Not allowed to reply." }, 403);
    const discussionId = c.req.param("id");
    if (!(await canReadDiscussion(context, c.get("userId"), discussionId)))
      return c.json({ error: "Discussion not found." }, 404);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const message = String(body?.body || "").trim();
    if (!message || message.length > 5000)
      return c.json({ error: "Reply must contain 1 to 5000 characters." }, 400);
    const created = await pool.query(
      `INSERT INTO school_lms_discussion_replies(discussion_id,school_owner_id,body,author_user_id,author_name)
       SELECT d.id,d.school_owner_id,$3,$4,$5 FROM school_lms_discussions d
       WHERE d.id=$1 AND d.school_owner_id=$2 AND d.closed_at IS NULL
       RETURNING id,body,author_name AS "authorName",created_at AS "createdAt"`,
      [discussionId, context.schoolId, message, c.get("userId"), context.name],
    );
    if (!created.rowCount) return c.json({ error: "This discussion is closed." }, 409);
    return c.json(created.rows[0], 201);
  });

  app.delete("/api/lms/topics/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to delete topics." }, 403);
    const topic = await pool.query(
      "SELECT class_id,subject FROM school_lms_topics WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !topic.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        topic.rows[0].class_id,
        topic.rows[0].subject,
        "*",
      ))
    )
      return c.json({ error: "Topic not found or you are not assigned to it." }, 404);
    await pool.query(
      "UPDATE school_lms_materials SET topic_id=NULL WHERE topic_id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    await pool.query("DELETE FROM school_lms_topics WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    return c.json({ ok: true });
  });
  app.patch("/api/lms/topics/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to update topics." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const title = String(body?.title || "").trim();
    if (!title || title.length > 180)
      return c.json({ error: "Enter a topic name up to 180 characters." }, 400);
    const topic = await pool.query(
      "SELECT class_id,subject FROM school_lms_topics WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !topic.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        topic.rows[0].class_id,
        topic.rows[0].subject,
        "*",
      ))
    )
      return c.json({ error: "Topic not found or you are not assigned to it." }, 404);
    const duplicate = await pool.query(
      "SELECT 1 FROM school_lms_topics WHERE school_owner_id=$1 AND class_id=$2 AND subject=$3 AND lower(title)=lower($4) AND id<>$5 LIMIT 1",
      [x.schoolId, topic.rows[0].class_id, topic.rows[0].subject, title, c.req.param("id")],
    );
    if (duplicate.rowCount)
      return c.json({ error: "A topic with that name already exists for this subject." }, 409);
    const saved = await pool.query(
      "UPDATE school_lms_topics SET title=$3 WHERE id=$1 AND school_owner_id=$2 RETURNING id,title",
      [c.req.param("id"), x.schoolId, title],
    );
    return c.json(saved.rows[0]);
  });
  app.patch("/api/lms/materials/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to update learning materials." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const item = await pool.query(
      "SELECT class_id,subject,stream,material_type FROM school_lms_materials WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !item.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        item.rows[0].class_id,
        item.rows[0].subject,
        item.rows[0].stream,
      ))
    )
      return c.json({ error: "Material not found or you are not assigned to it." }, 404);
    const title = String(body?.title || "").trim(),
      description = String(body?.description || "").trim(),
      content = String(body?.body || ""),
      url = String(body?.externalUrl || "").trim(),
      status = String(body?.status || "");
    if (
      !title ||
      title.length > 180 ||
      description.length > 3000 ||
      !["draft", "published"].includes(status) ||
      (item.rows[0].material_type === "note" && !content.trim())
    )
      return c.json({ error: "Provide a title and valid content and status." }, 400);
    await pool.query(
      "UPDATE school_lms_materials SET title=$3,description=$4,body=$5,external_url=$6,publication_status=$7,updated_at=now() WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId, title, description, content, url, status],
    );
    return c.json({ ok: true });
  });
  app.delete("/api/lms/materials/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to delete learning materials." }, 403);
    const material = await pool.query(
      "SELECT class_id,subject,stream,file_key FROM school_lms_materials WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !material.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        material.rows[0].class_id,
        material.rows[0].subject,
        material.rows[0].stream,
      ))
    )
      return c.json({ error: "Material not found or you are not assigned to it." }, 404);
    await pool.query(
      "DELETE FROM school_lms_progress WHERE material_id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    await pool.query("DELETE FROM school_lms_materials WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    if (material.rows[0].file_key)
      await s3.send(
        new DeleteObjectCommand({ Bucket: imageBucket, Key: material.rows[0].file_key }),
      );
    return c.json({ ok: true });
  });
  app.delete("/api/lms/assignments/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to delete assignments." }, 403);
    const assignment = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assignments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !assignment.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        assignment.rows[0].class_id,
        assignment.rows[0].subject,
        assignment.rows[0].stream,
      ))
    )
      return c.json({ error: "Assignment not found or you are not assigned to it." }, 404);
    const submissions = await pool.query(
      "SELECT 1 FROM school_lms_submissions WHERE assignment_id=$1 LIMIT 1",
      [c.req.param("id")],
    );
    if (submissions.rowCount)
      return c.json(
        {
          error:
            "This assignment has student submissions, so it is kept for the student record. Edit or close it instead.",
        },
        409,
      );
    await pool.query("DELETE FROM school_lms_assignments WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    return c.json({ ok: true });
  });
  app.patch("/api/lms/assignments/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to update assignments." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const item = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assignments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !item.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        item.rows[0].class_id,
        item.rows[0].subject,
        item.rows[0].stream,
      ))
    )
      return c.json({ error: "Assignment not found or you are not assigned to it." }, 404);
    const title = String(body?.title || "").trim(),
      instructions = String(body?.instructions || "").trim(),
      status = String(body?.status || "");
    if (
      !title ||
      title.length > 180 ||
      instructions.length > 10000 ||
      !["draft", "published"].includes(status)
    )
      return c.json({ error: "Provide a title, instructions, and valid status." }, 400);
    await pool.query(
      "UPDATE school_lms_assignments SET title=$3,instructions=$4,publication_status=$5 WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId, title, instructions, status],
    );
    return c.json({ ok: true });
  });
  app.delete("/api/lms/assessments/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to delete assessments." }, 403);
    const assessment = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assessments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !assessment.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        assessment.rows[0].class_id,
        assessment.rows[0].subject,
        assessment.rows[0].stream,
      ))
    )
      return c.json({ error: "Assessment not found or you are not assigned to it." }, 404);
    const attempts = await pool.query(
      "SELECT 1 FROM school_lms_attempts WHERE assessment_id=$1 LIMIT 1",
      [c.req.param("id")],
    );
    if (attempts.rowCount)
      return c.json(
        { error: "This assessment has student attempts, so it is kept for the student record." },
        409,
      );
    await pool.query("DELETE FROM school_lms_assessments WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      x.schoolId,
    ]);
    return c.json({ ok: true });
  });
  app.patch("/api/lms/assessments/:id", async (c) => {
    const x = await guard(c, "manage_lms");
    if (!x) return c.json({ error: "Not allowed to update assessments." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const item = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assessments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId],
    );
    if (
      !item.rowCount ||
      !(await canManageLearning(
        x,
        c.get("userId"),
        item.rows[0].class_id,
        item.rows[0].subject,
        item.rows[0].stream,
      ))
    )
      return c.json({ error: "Assessment not found or you are not assigned to it." }, 404);
    const title = String(body?.title || "").trim(),
      instructions = String(body?.instructions || "").trim(),
      status = String(body?.status || "");
    if (
      !title ||
      title.length > 180 ||
      instructions.length > 10000 ||
      !["draft", "published"].includes(status)
    )
      return c.json({ error: "Provide a title, instructions, and valid status." }, 400);
    await pool.query(
      "UPDATE school_lms_assessments SET title=$3,instructions=$4,publication_status=$5 WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), x.schoolId, title, instructions, status],
    );
    return c.json({ ok: true });
  });

  app.get("/api/lms/topics", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view learning topics." }, 403);
    const classId = c.req.query("classId") || "";
    const result = await pool.query(
      `SELECT t.id,t.class_id AS "classId",c.name AS "className",t.subject,t.title,t.description,
        t.created_by AS "createdBy",t.created_at AS "createdAt"
       FROM school_lms_topics t JOIN school_classes c ON c.id=t.class_id AND c.school_owner_id=t.school_owner_id
       WHERE t.school_owner_id=$1 AND ($2='' OR t.class_id::text=$2)
         AND ($3<>'Student' OR EXISTS (SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=t.school_owner_id AND s.class_name=c.name AND s.status='Active'))
         AND ($3<>'Teacher' OR EXISTS(SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=t.school_owner_id AND a.user_id=$5 AND a.class_id=t.class_id AND a.subjects ? t.subject))
       ORDER BY c.name,t.subject,t.title`,
      [context.schoolId, classId, context.role, context.studentId || null, c.get("userId")],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/topics", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to manage learning topics." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(body?.classId || "");
    const subject = String(body?.subject || "").trim();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    if (!classId || !subject || !title || title.length > 180 || description.length > 3000)
      return c.json({ error: "Choose a class and subject and provide a topic title." }, 400);
    if (!(await canManageLearning(context, c.get("userId"), classId, subject, "*")))
      return c.json({ error: "You are not assigned to this class and subject." }, 403);
    const created = await pool.query(
      `INSERT INTO school_lms_topics(school_owner_id,class_id,subject,title,description,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,class_id AS "classId",subject,title,description,created_at AS "createdAt"`,
      [context.schoolId, classId, subject, title, description, c.get("userId")],
    );
    return c.json(created.rows[0], 201);
  });

  app.get("/api/lms/materials", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view learning materials." }, 403);
    const classId = c.req.query("classId") || "";
    const result = await pool.query(
      `SELECT m.id,m.class_id AS "classId",c.name AS "className",m.subject,m.stream,
        m.topic_id AS "topicId",t.title AS topic,m.title,m.description,m.material_type AS type,
        m.body,m.file_name AS "fileName",m.mime_type AS "mimeType",m.external_url AS "externalUrl",
        m.term,m.academic_year AS "academicYear",m.publication_status AS status,
        m.publish_at AS "publishAt",m.created_by_name AS "createdByName",m.created_at AS "createdAt"
       FROM school_lms_materials m JOIN school_classes c ON c.id=m.class_id AND c.school_owner_id=m.school_owner_id
       LEFT JOIN school_lms_topics t ON t.id=m.topic_id AND t.school_owner_id=m.school_owner_id
       WHERE m.school_owner_id=$1 AND ($2='' OR m.class_id::text=$2)
         AND (($3='Admin') OR ($3='Teacher' AND EXISTS(SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$4 AND a.class_id=m.class_id AND (a.stream=m.stream OR m.stream='*') AND a.subjects ? m.subject)) OR ($3='Student' AND m.publication_status='published' AND EXISTS
           (SELECT 1 FROM school_students s WHERE s.id=$5::uuid AND s.school_owner_id=m.school_owner_id AND s.class_name=c.name AND s.status='Active' AND (m.stream='*' OR m.stream=s.stream) AND c.subjects ? m.subject))
           OR ($3<>'Student' AND m.created_by=$4))
       ORDER BY m.created_at DESC`,
      [context.schoolId, classId, context.role, c.get("userId"), context.studentId || null],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/materials", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to publish learning materials." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(body?.classId || "");
    const subject = String(body?.subject || "").trim();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    const type = String(body?.type || "note");
    const stream = String(body?.stream || "*");
    const topicId = String(body?.topicId || "") || null;
    const bodyText = String(body?.body || "");
    const externalUrl = String(body?.externalUrl || "").trim();
    const term = String(body?.term || "").trim();
    const academicYear = String(body?.academicYear || "").trim();
    const status = String(body?.status || "draft");
    if (!classId || !subject || !title || title.length > 180 || description.length > 3000)
      return c.json({ error: "Choose a class and subject and provide a material title." }, 400);
    if (!(type === "note" || type === "video") || (type === "note" && !bodyText.trim()))
      return c.json({ error: "Provide note content or choose an external video." }, 400);
    if (type === "video") {
      let parsed: URL;
      try {
        parsed = new URL(externalUrl);
      } catch {
        return c.json({ error: "Enter a valid video URL." }, 400);
      }
      if (!["https:", "http:"].includes(parsed.protocol))
        return c.json({ error: "Video URLs must use HTTP or HTTPS." }, 400);
    }
    if (!(status === "draft" || status === "published"))
      return c.json({ error: "Choose draft or published status." }, 400);
    if (
      (stream === "*" && context.role !== "Admin") ||
      !(await canManageLearning(context, c.get("userId"), classId, subject, stream))
    )
      return c.json({ error: "You are not assigned to this class, stream, and subject." }, 403);
    if (topicId) {
      const topic = await pool.query(
        "SELECT 1 FROM school_lms_topics WHERE id=$1 AND school_owner_id=$2 AND class_id=$3 AND subject=$4",
        [topicId, context.schoolId, classId, subject],
      );
      if (!topic.rowCount) return c.json({ error: "The selected topic is unavailable." }, 400);
    }
    const created = await pool.query(
      `INSERT INTO school_lms_materials(school_owner_id,class_id,subject,stream,topic_id,title,description,material_type,body,external_url,term,academic_year,publication_status,created_by,created_by_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id,class_id AS "classId",subject,stream,topic_id AS "topicId",title,description,material_type AS type,body,external_url AS "externalUrl",term,academic_year AS "academicYear",publication_status AS status,created_at AS "createdAt"`,
      [
        context.schoolId,
        classId,
        subject,
        stream,
        topicId,
        title,
        description,
        type,
        bodyText,
        externalUrl,
        term,
        academicYear,
        status,
        c.get("userId"),
        context.name,
      ],
    );
    return c.json(created.rows[0], 201);
  });

  app.post("/api/lms/materials/upload", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to upload learning materials." }, 403);
    const classId = c.req.query("classId") || "";
    const subject = (c.req.query("subject") || "").trim();
    const stream = c.req.query("stream") || "*";
    const title = (c.req.query("title") || "").trim();
    const description = (c.req.query("description") || "").trim();
    const topicId = c.req.query("topicId") || null;
    const term = c.req.query("term") || "";
    const academicYear = c.req.query("academicYear") || "";
    const status = c.req.query("status") || "draft";
    let decodedFileName = c.req.header("X-File-Name") || "";
    try {
      decodedFileName = decodeURIComponent(decodedFileName);
    } catch {
      return c.json({ error: "Invalid file name." }, 400);
    }
    const fileName = decodedFileName.split(/[\\/]/).pop() || "";
    const mimeType =
      (c.req.header("Content-Type") || "application/octet-stream").split(";")[0]?.toLowerCase() ||
      "";
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const accepted: Record<string, string[]> = {
      pdf: ["application/pdf"],
      doc: ["application/msword"],
      docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ppt: ["application/vnd.ms-powerpoint"],
      pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      xls: ["application/vnd.ms-excel"],
      xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
      png: ["image/png"],
      webp: ["image/webp"],
      mp3: ["audio/mpeg", "audio/mp3"],
      wav: ["audio/wav", "audio/x-wav"],
      m4a: ["audio/mp4"],
      mp4: ["video/mp4"],
      webm: ["video/webm"],
      zip: ["application/zip", "application/x-zip-compressed"],
      txt: ["text/plain"],
    };
    if (
      !classId ||
      !subject ||
      !title ||
      title.length > 180 ||
      description.length > 3000 ||
      !(status === "draft" || status === "published")
    )
      return c.json({ error: "Choose class, subject, title, and publication status." }, 400);
    if (!accepted[extension]?.includes(mimeType))
      return c.json(
        { error: "This file type is not allowed or its MIME type does not match its extension." },
        400,
      );
    if ((Number(c.req.header("Content-Length")) || 0) > 20 * 1024 * 1024)
      return c.json({ error: "Learning files are limited to 20 MB." }, 413);
    if (
      !(await canManageLearning(context, c.get("userId"), classId, subject, stream)) ||
      (stream === "*" && context.role !== "Admin")
    )
      return c.json({ error: "You are not assigned to this class, stream, and subject." }, 403);
    if (topicId) {
      const topic = await pool.query(
        "SELECT 1 FROM school_lms_topics WHERE id=$1 AND school_owner_id=$2 AND class_id=$3 AND subject=$4",
        [topicId, context.schoolId, classId, subject],
      );
      if (!topic.rowCount) return c.json({ error: "The selected topic is unavailable." }, 400);
    }
    const bytes = await c.req.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024)
      return c.json({ error: "The file must be between 1 byte and 20 MB." }, 413);
    const key = `learning/${context.schoolId}/${randomUUID()}.${extension}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: imageBucket,
        Key: key,
        Body: new Uint8Array(bytes),
        ContentType: mimeType,
      }),
    );
    try {
      const created = await pool.query(
        `INSERT INTO school_lms_materials(school_owner_id,class_id,subject,stream,topic_id,title,description,material_type,file_key,file_name,mime_type,term,academic_year,publication_status,created_by,created_by_name)
         VALUES($1,$2,$3,$4,$5,$6,$7,'file',$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id,class_id AS "classId",subject,stream,title,description,file_name AS "fileName",mime_type AS "mimeType",publication_status AS status,created_at AS "createdAt"`,
        [
          context.schoolId,
          classId,
          subject,
          stream,
          topicId,
          title,
          description,
          key,
          fileName.slice(0, 255),
          mimeType,
          term,
          academicYear,
          status,
          c.get("userId"),
          context.name,
        ],
      );
      return c.json(created.rows[0], 201);
    } catch (error) {
      await s3
        .send(new DeleteObjectCommand({ Bucket: imageBucket, Key: key }))
        .catch(() => undefined);
      throw error;
    }
  });

  app.get("/api/lms/materials/:id/download", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to access learning materials." }, 403);
    const item = await pool.query(
      `SELECT m.file_key,m.file_name,m.mime_type FROM school_lms_materials m JOIN school_classes c ON c.id=m.class_id AND c.school_owner_id=m.school_owner_id
       WHERE m.id=$1 AND m.school_owner_id=$2 AND m.publication_status='published' AND m.material_type='file'
       AND ($3<>'Student' OR EXISTS(SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=m.school_owner_id AND s.class_name=c.name AND s.status='Active' AND (m.stream='*' OR m.stream=s.stream) AND c.subjects ? m.subject))
       AND ($3<>'Teacher' OR EXISTS(SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$5 AND a.class_id=m.class_id AND (a.stream=m.stream OR m.stream='*') AND a.subjects ? m.subject))`,
      [
        c.req.param("id"),
        context.schoolId,
        context.role,
        context.studentId || null,
        c.get("userId"),
      ],
    );
    if (!item.rowCount || !item.rows[0].file_key)
      return c.json({ error: "Published file not found." }, 404);
    if (context.studentId) {
      await pool.query(
        `INSERT INTO school_lms_progress(school_owner_id,student_id,material_id,download_count)
         SELECT m.school_owner_id,$2,m.id,1 FROM school_lms_materials m JOIN school_classes cl ON cl.id=m.class_id AND cl.school_owner_id=m.school_owner_id
         JOIN school_students st ON st.id=$2 AND st.school_owner_id=m.school_owner_id AND st.class_name=cl.name AND st.status='Active'
         WHERE m.id=$1 AND m.publication_status='published' AND (m.stream='*' OR m.stream=st.stream) AND cl.subjects ? m.subject
         ON CONFLICT(student_id,material_id) DO UPDATE SET last_activity_at=now(),download_count=school_lms_progress.download_count+1`,
        [c.req.param("id"), context.studentId],
      );
    }
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: imageBucket, Key: item.rows[0].file_key }),
      { expiresIn: 300 },
    );
    return c.json({ url, fileName: item.rows[0].file_name, mimeType: item.rows[0].mime_type });
  });

  app.get("/api/lms/questions", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view the question bank." }, 403);
    if (context.role === "Student")
      return c.json({ error: "Students cannot access the teacher question bank." }, 403);
    const result = await pool.query(
      `SELECT q.id,q.class_id AS "classId",c.name AS "className",q.subject,q.topic_id AS "topicId",
        t.title AS topic,q.question_type AS type,q.prompt,q.options,q.answer_key AS "answerKey",
        q.explanation,q.marks,q.created_at AS "createdAt"
       FROM school_lms_question_bank q JOIN school_classes c ON c.id=q.class_id AND c.school_owner_id=q.school_owner_id
       LEFT JOIN school_lms_topics t ON t.id=q.topic_id AND t.school_owner_id=q.school_owner_id
       WHERE q.school_owner_id=$1 AND ($2='Admin' OR q.created_by=$3 OR EXISTS
         (SELECT 1 FROM school_teacher_assignments a WHERE a.school_owner_id=q.school_owner_id AND a.user_id=$3 AND a.class_id=q.class_id AND a.subjects ? q.subject))
       ORDER BY q.created_at DESC LIMIT 500`,
      [context.schoolId, context.role, c.get("userId")],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/questions", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to manage the question bank." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(body?.classId || "");
    const subject = String(body?.subject || "").trim();
    const prompt = String(body?.prompt || "").trim();
    const type = String(body?.type || "");
    const allowed = [
      "multiple_choice",
      "true_false",
      "short_answer",
      "fill_blank",
      "matching",
      "essay",
    ];
    const marks = Number(body?.marks || 1);
    if (
      !classId ||
      !subject ||
      !prompt ||
      prompt.length > 10000 ||
      !allowed.includes(type) ||
      !Number.isFinite(marks) ||
      marks <= 0
    )
      return c.json(
        {
          error:
            "Provide a class, subject, valid question type, question text, and positive marks.",
        },
        400,
      );
    if (!(await canManageLearning(context, c.get("userId"), classId, subject, "*")))
      return c.json({ error: "You are not assigned to this class and subject." }, 403);
    const options = Array.isArray(body?.options) ? body.options : [];
    if (type === "multiple_choice" && options.length < 2)
      return c.json({ error: "Multiple choice questions need at least two answer options." }, 400);
    const created = await pool.query(
      `INSERT INTO school_lms_question_bank(school_owner_id,class_id,subject,topic_id,question_type,prompt,options,answer_key,explanation,marks,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)
       RETURNING id,class_id AS "classId",subject,topic_id AS "topicId",question_type AS type,prompt,options,answer_key AS "answerKey",explanation,marks,created_at AS "createdAt"`,
      [
        context.schoolId,
        classId,
        subject,
        String(body?.topicId || "") || null,
        type,
        prompt,
        JSON.stringify(options),
        JSON.stringify(body?.answerKey ?? null),
        String(body?.explanation || "").slice(0, 3000),
        marks,
        c.get("userId"),
      ],
    );
    return c.json(created.rows[0], 201);
  });

  app.patch("/api/lms/questions/:id", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to manage the question bank." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = String(body?.prompt || "").trim();
    const marks = Number(body?.marks);
    if (!prompt || prompt.length > 10000 || !Number.isFinite(marks) || marks <= 0)
      return c.json({ error: "Enter question text and a positive mark value." }, 400);
    const question = await pool.query(
      "SELECT class_id,subject FROM school_lms_question_bank WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (!question.rowCount) return c.json({ error: "Question not found." }, 404);
    if (
      !(await canManageLearning(
        context,
        c.get("userId"),
        question.rows[0].class_id,
        question.rows[0].subject,
        "*",
      ))
    )
      return c.json({ error: "You are not assigned to this class and subject." }, 403);
    const attempted = await pool.query(
      `SELECT 1 FROM school_lms_assessment_questions aq JOIN school_lms_attempts a ON a.assessment_id=aq.assessment_id
       WHERE aq.question_id=$1 LIMIT 1`,
      [c.req.param("id")],
    );
    if (attempted.rowCount)
      return c.json(
        { error: "This question has student attempts and can no longer be edited." },
        409,
      );
    const saved = await pool.query(
      "UPDATE school_lms_question_bank SET prompt=$3,marks=$4,updated_at=now() WHERE id=$1 AND school_owner_id=$2 RETURNING id,prompt,marks",
      [c.req.param("id"), context.schoolId, prompt, marks],
    );
    return c.json(saved.rows[0]);
  });

  app.delete("/api/lms/questions/:id", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to manage the question bank." }, 403);
    const question = await pool.query(
      "SELECT class_id,subject FROM school_lms_question_bank WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (!question.rowCount) return c.json({ error: "Question not found." }, 404);
    if (
      !(await canManageLearning(
        context,
        c.get("userId"),
        question.rows[0].class_id,
        question.rows[0].subject,
        "*",
      ))
    )
      return c.json({ error: "You are not assigned to this class and subject." }, 403);
    const referenced = await pool.query(
      "SELECT 1 FROM school_lms_assessment_questions WHERE question_id=$1 LIMIT 1",
      [c.req.param("id")],
    );
    if (referenced.rowCount)
      return c.json(
        { error: "Remove this question from its assessments before deleting it." },
        409,
      );
    await pool.query("DELETE FROM school_lms_question_bank WHERE id=$1 AND school_owner_id=$2", [
      c.req.param("id"),
      context.schoolId,
    ]);
    return c.json({ ok: true });
  });

  app.get("/api/lms/assessments", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view assessments." }, 403);
    const rows = await pool.query(
      `SELECT a.id,a.class_id AS "classId",cl.name AS "className",a.subject,a.stream,a.title,a.instructions,
        a.starts_at AS "startsAt",a.ends_at AS "endsAt",a.duration_minutes AS "durationMinutes",a.attempts_allowed AS "attemptsAllowed",
        a.results_released AS "resultsReleased",a.publication_status AS status,a.created_by_name AS "createdByName",
        (SELECT count(*) FROM school_lms_assessment_questions aq WHERE aq.assessment_id=a.id) AS "questionCount",
        (SELECT COALESCE(sum(q.marks),0) FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=a.id) AS "maxMarks",
        (SELECT count(*) FROM school_lms_attempts at WHERE at.assessment_id=a.id AND at.student_id=$4::uuid) AS "attemptsUsed",
        (SELECT count(*)::int FROM school_lms_attempts at WHERE at.assessment_id=a.id) AS "attemptCount",
        (SELECT count(*)::int FROM school_lms_attempts at WHERE at.assessment_id=a.id AND at.status='in_progress') AS "openAttemptCount",
        (SELECT count(*)::int FROM school_lms_attempts at JOIN school_lms_assessment_questions aq ON aq.assessment_id=a.id JOIN school_lms_question_bank q ON q.id=aq.question_id LEFT JOIN school_lms_attempt_answers aa ON aa.attempt_id=at.id AND aa.question_id=q.id WHERE at.assessment_id=a.id AND at.status IN ('submitted','marked') AND q.question_type IN ('essay','matching') AND aa.marks_awarded IS NULL) AS "pendingReviewCount",
        CASE WHEN $2='Student' THEN (SELECT at.score FROM school_lms_attempts at WHERE at.assessment_id=a.id AND at.student_id=$4::uuid AND at.status IN ('submitted','marked') AND (a.results_released OR NOT EXISTS (SELECT 1 FROM school_lms_attempt_answers aa JOIN school_lms_question_bank q ON q.id=aa.question_id WHERE aa.attempt_id=at.id AND q.question_type IN ('essay','matching') AND aa.marks_awarded IS NULL)) ORDER BY at.attempt_number DESC LIMIT 1) ELSE NULL END AS "releasedScore"
       FROM school_lms_assessments a JOIN school_classes cl ON cl.id=a.class_id AND cl.school_owner_id=a.school_owner_id
       WHERE a.school_owner_id=$1 AND ($2='Admin' OR ($2='Student' AND a.publication_status='published' AND EXISTS(SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=a.school_owner_id AND s.status='Active' AND s.class_name=cl.name AND s.stream=a.stream OR s.id=$4::uuid AND a.stream='*' AND s.school_owner_id=a.school_owner_id AND s.status='Active' AND s.class_name=cl.name AND cl.subjects ? a.subject)) OR ($2='Teacher' AND EXISTS(SELECT 1 FROM school_teacher_assignments ta WHERE ta.school_owner_id=a.school_owner_id AND ta.user_id=$3 AND ta.class_id=a.class_id AND (a.stream='*' OR ta.stream=a.stream) AND ta.subjects ? a.subject)))
       ORDER BY a.starts_at NULLS FIRST,a.created_at DESC LIMIT 300`,
      [context.schoolId, context.role, c.get("userId"), context.studentId || null],
    );
    return c.json(rows.rows);
  });

  app.post("/api/lms/assessments", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to create assessments." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(b?.classId || ""),
      subject = String(b?.subject || "").trim();
    const stream = String(b?.stream || "*"),
      title = String(b?.title || "").trim();
    const questionIds = Array.isArray(b?.questionIds)
      ? [...new Set(b.questionIds.map(String))]
      : [];
    const duration = Number(b?.durationMinutes || 0),
      attempts = Number(b?.attemptsAllowed || 1);
    const starts = b?.startsAt ? new Date(String(b.startsAt)) : null;
    const ends = b?.endsAt ? new Date(String(b.endsAt)) : null;
    if (
      !classId ||
      !subject ||
      !title ||
      title.length > 180 ||
      questionIds.length < 1 ||
      questionIds.length > 100 ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 600 ||
      !Number.isInteger(attempts) ||
      attempts < 1 ||
      attempts > 10 ||
      (starts && !Number.isFinite(starts.getTime())) ||
      (ends && !Number.isFinite(ends.getTime())) ||
      (starts && ends && ends <= starts)
    )
      return c.json(
        {
          error:
            "Provide an assessment title, at least one question, valid schedule, duration, and attempt limit.",
        },
        400,
      );
    if (stream === "*" && context.role !== "Admin")
      return c.json({ error: "Teachers must choose an assigned stream." }, 403);
    if (!(await canManageLearning(context, c.get("userId"), classId, subject, stream)))
      return c.json({ error: "You are not assigned to this class, stream, and subject." }, 403);
    const qrows = await pool.query(
      "SELECT id FROM school_lms_question_bank WHERE school_owner_id=$1 AND class_id=$2 AND subject=$3 AND id=ANY($4::uuid[])",
      [context.schoolId, classId, subject, questionIds],
    );
    if (qrows.rowCount !== questionIds.length)
      return c.json(
        { error: "Every selected question must belong to this class and subject." },
        400,
      );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const created = await client.query(
        `INSERT INTO school_lms_assessments(school_owner_id,class_id,subject,stream,title,instructions,starts_at,ends_at,duration_minutes,attempts_allowed,publication_status,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          context.schoolId,
          classId,
          subject,
          stream,
          title,
          String(b?.instructions || "").slice(0, 10000),
          starts?.toISOString() || null,
          ends?.toISOString() || null,
          duration,
          attempts,
          b?.status === "published" ? "published" : "draft",
          c.get("userId"),
          context.name,
        ],
      );
      for (let i = 0; i < questionIds.length; i++)
        await client.query(
          "INSERT INTO school_lms_assessment_questions(assessment_id,question_id,position) VALUES($1,$2,$3)",
          [created.rows[0].id, questionIds[i], i],
        );
      await client.query("COMMIT");
      return c.json({ id: created.rows[0].id }, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/lms/assessments/:id/results-release", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to release results." }, 403);
    const found = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assessments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (
      !found.rowCount ||
      !(await canManageLearning(
        context,
        c.get("userId"),
        found.rows[0].class_id,
        found.rows[0].subject,
        found.rows[0].stream,
      ))
    )
      return c.json({ error: "Assessment not found or outside your permissions." }, 404);
    const unfinished = await pool.query(
      `SELECT count(*)::int AS count FROM school_lms_attempts at JOIN school_lms_assessments a ON a.id=at.assessment_id JOIN school_lms_assessment_questions aq ON aq.assessment_id=a.id JOIN school_lms_question_bank q ON q.id=aq.question_id LEFT JOIN school_lms_attempt_answers aa ON aa.attempt_id=at.id AND aa.question_id=q.id WHERE a.id=$1 AND (at.status='in_progress' OR (at.status IN ('submitted','marked') AND q.question_type IN ('essay','matching') AND aa.marks_awarded IS NULL))`,
      [c.req.param("id")],
    );
    if (Number(unfinished.rows[0]?.count || 0) > 0)
      return c.json(
        {
          error:
            "Submit all open attempts and mark every essay and matching response before releasing results.",
        },
        409,
      );
    await pool.query(
      "UPDATE school_lms_assessments SET results_released=true WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    return c.json({ released: true });
  });

  app.get("/api/lms/assessments/:id/attempts", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to review assessment attempts." }, 403);
    const assessment = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assessments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (
      !assessment.rowCount ||
      !(await canManageLearning(
        context,
        c.get("userId"),
        assessment.rows[0].class_id,
        assessment.rows[0].subject,
        assessment.rows[0].stream,
      ))
    )
      return c.json({ error: "Assessment not found or outside your permissions." }, 404);
    const rows = await pool.query(
      `SELECT at.id,at.attempt_number AS "attemptNumber",at.status,at.score,at.submitted_at AS "submittedAt",s.admission_no AS "admissionNo",s.first_name AS "firstName",s.last_name AS "lastName",q.id AS "questionId",q.question_type AS type,q.prompt,q.answer_key AS "answerKey",q.explanation,q.marks,aa.answer,aa.marks_awarded AS "marksAwarded",aa.feedback FROM school_lms_attempts at JOIN school_students s ON s.id=at.student_id AND s.school_owner_id=at.school_owner_id LEFT JOIN school_lms_assessment_questions aq ON aq.assessment_id=at.assessment_id LEFT JOIN school_lms_question_bank q ON q.id=aq.question_id LEFT JOIN school_lms_attempt_answers aa ON aa.attempt_id=at.id AND aa.question_id=q.id WHERE at.assessment_id=$1 AND at.school_owner_id=$2 ORDER BY at.submitted_at DESC NULLS LAST,s.last_name,s.first_name,aq.position`,
      [c.req.param("id"), context.schoolId],
    );
    const attempts = new Map<string, Record<string, unknown>>();
    for (const row of rows.rows) {
      let attempt = attempts.get(row.id);
      if (!attempt) {
        attempt = {
          id: row.id,
          attemptNumber: row.attemptNumber,
          status: row.status,
          score: row.score,
          submittedAt: row.submittedAt,
          admissionNo: row.admissionNo,
          studentName: `${row.firstName} ${row.lastName}`,
          questions: [],
        };
        attempts.set(row.id, attempt);
      }
      if (row.questionId)
        (attempt.questions as Record<string, unknown>[]).push({
          id: row.questionId,
          type: row.type,
          prompt: row.prompt,
          answer: row.answer,
          answerKey: row.answerKey,
          explanation: row.explanation,
          marks: row.marks,
          marksAwarded: row.marksAwarded,
          feedback: row.feedback,
        });
    }
    return c.json([...attempts.values()]);
  });

  app.post("/api/lms/attempts/:attemptId/answers/:questionId/mark", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to mark assessment answers." }, 403);
    const match = await pool.query(
      `SELECT at.id,at.assessment_id,a.class_id,a.subject,a.stream,q.marks,q.question_type FROM school_lms_attempts at JOIN school_lms_assessments a ON a.id=at.assessment_id AND a.school_owner_id=at.school_owner_id JOIN school_lms_assessment_questions aq ON aq.assessment_id=a.id AND aq.question_id=$3 JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE at.id=$1 AND at.school_owner_id=$2 AND at.status IN ('submitted','marked') AND q.question_type IN ('essay','matching')`,
      [c.req.param("attemptId"), context.schoolId, c.req.param("questionId")],
    );
    if (
      !match.rowCount ||
      !(await canManageLearning(
        context,
        c.get("userId"),
        match.rows[0].class_id,
        match.rows[0].subject,
        match.rows[0].stream,
      ))
    )
      return c.json({ error: "Submitted answer not found or outside your permissions." }, 404);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null,
      marks = Number(body?.marks),
      feedback = String(body?.feedback || "").trim();
    if (
      !Number.isFinite(marks) ||
      marks < 0 ||
      marks > Number(match.rows[0].marks) ||
      feedback.length > 5000
    )
      return c.json(
        {
          error:
            "Enter marks from zero to the question maximum and feedback up to 5000 characters.",
        },
        400,
      );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO school_lms_attempt_answers(attempt_id,question_id,answer,marks_awarded,feedback) VALUES($1,$2,'null'::jsonb,$3,$4) ON CONFLICT(attempt_id,question_id) DO UPDATE SET marks_awarded=EXCLUDED.marks_awarded,feedback=EXCLUDED.feedback,updated_at=now()`,
        [match.rows[0].id, c.req.param("questionId"), marks, feedback],
      );
      const pending = await client.query(
        `SELECT count(*)::int AS n FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id LEFT JOIN school_lms_attempt_answers aa ON aa.attempt_id=$1 AND aa.question_id=q.id WHERE aq.assessment_id=$2 AND q.question_type IN ('essay','matching') AND aa.marks_awarded IS NULL`,
        [match.rows[0].id, match.rows[0].assessment_id],
      );
      await client.query(
        `UPDATE school_lms_attempts SET score=(SELECT COALESCE(sum(marks_awarded),0) FROM school_lms_attempt_answers WHERE attempt_id=$1),status=CASE WHEN $2::int=0 THEN 'marked' ELSE 'submitted' END,marked_by=CASE WHEN $2::int=0 THEN $3 ELSE NULL END,marked_at=CASE WHEN $2::int=0 THEN now() ELSE NULL END WHERE id=$1`,
        [match.rows[0].id, pending.rows[0].n, c.get("userId")],
      );
      await client.query("COMMIT");
      return c.json({ saved: true, fullyMarked: Number(pending.rows[0].n) === 0 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/lms/assessments/:id/start", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const a = await client.query(
        `SELECT a.* FROM school_lms_assessments a JOIN school_classes cl ON cl.id=a.class_id AND cl.school_owner_id=a.school_owner_id JOIN school_students s ON s.id=$2 AND s.school_owner_id=a.school_owner_id AND s.class_name=cl.name AND s.status='Active' AND (a.stream='*' OR a.stream=s.stream) AND cl.subjects ? a.subject WHERE a.id=$1 AND a.school_owner_id=$3 AND a.publication_status='published' FOR UPDATE OF a`,
        [c.req.param("id"), context.studentId, context.schoolId],
      );
      if (!a.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Assessment is unavailable to this student." }, 404);
      }
      const row = a.rows[0],
        now = Date.now();
      if (row.starts_at && new Date(row.starts_at).getTime() > now) {
        await client.query("ROLLBACK");
        return c.json({ error: "This assessment has not started." }, 409);
      }
      if (row.ends_at && new Date(row.ends_at).getTime() <= now) {
        await client.query("ROLLBACK");
        return c.json({ error: "The assessment window has closed." }, 409);
      }
      let attempt = await client.query(
        "SELECT id,deadline_at,status FROM school_lms_attempts WHERE assessment_id=$1 AND student_id=$2 AND status='in_progress' ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE",
        [row.id, context.studentId],
      );
      if (!attempt.rowCount) {
        const used = await client.query(
          "SELECT count(*)::int AS n FROM school_lms_attempts WHERE assessment_id=$1 AND student_id=$2",
          [row.id, context.studentId],
        );
        if (used.rows[0].n >= row.attempts_allowed) {
          await client.query("ROLLBACK");
          return c.json({ error: "You have used all allowed attempts." }, 409);
        }
        const deadline = Math.min(
          now + row.duration_minutes * 60000,
          row.ends_at ? new Date(row.ends_at).getTime() : Number.MAX_SAFE_INTEGER,
        );
        attempt = await client.query(
          "INSERT INTO school_lms_attempts(school_owner_id,assessment_id,student_id,attempt_number,deadline_at) VALUES($1,$2,$3,$4,to_timestamp($5/1000.0)) RETURNING id,deadline_at,status",
          [context.schoolId, row.id, context.studentId, used.rows[0].n + 1, deadline],
        );
      }
      if (new Date(attempt.rows[0].deadline_at).getTime() <= now) {
        await client.query(
          `UPDATE school_lms_attempt_answers aa SET marks_awarded=CASE WHEN q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank') AND lower(btrim(COALESCE(aa.answer#>>'{}',''))) = lower(btrim(COALESCE(q.answer_key#>>'{}',''))) THEN q.marks WHEN q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank') THEN 0 ELSE NULL END FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=$1 AND aa.attempt_id=$2 AND aa.question_id=q.id`,
          [row.id, attempt.rows[0].id],
        );
        await client.query(
          `UPDATE school_lms_attempt_answers aa SET marks_awarded=0 FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=$1 AND aq.question_id=q.id AND aa.attempt_id=$2 AND aa.question_id=q.id AND aa.marks_awarded IS NULL AND q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank')`,
          [row.id, attempt.rows[0].id],
        );
        await client.query(
          `UPDATE school_lms_attempts SET status='submitted',submitted_at=deadline_at,score=(SELECT COALESCE(sum(marks_awarded),0) FROM school_lms_attempt_answers WHERE attempt_id=$1) WHERE id=$1`,
          [attempt.rows[0].id],
        );
        await client.query("COMMIT");
        return c.json({ error: "The time limit has passed." }, 409);
      }
      const questions = await client.query(
        `SELECT q.id,q.question_type AS type,q.prompt,q.options,q.marks,aa.answer FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id LEFT JOIN school_lms_attempt_answers aa ON aa.attempt_id=$1 AND aa.question_id=q.id WHERE aq.assessment_id=$2 ORDER BY aq.position`,
        [attempt.rows[0].id, row.id],
      );
      await client.query("COMMIT");
      return c.json({
        assessment: { id: row.id, title: row.title, instructions: row.instructions },
        attempt: attempt.rows[0],
        questions: questions.rows,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.put("/api/lms/attempts/:attemptId/answers/:questionId", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const answer = b?.answer;
    if (
      typeof answer !== "string" &&
      !Array.isArray(answer) &&
      (answer === null || typeof answer !== "object")
    )
      return c.json({ error: "Enter an answer." }, 400);
    const result = await pool.query(
      `INSERT INTO school_lms_attempt_answers(attempt_id,question_id,answer) SELECT at.id,q.id,$4::jsonb FROM school_lms_attempts at JOIN school_lms_assessment_questions aq ON aq.assessment_id=at.assessment_id AND aq.question_id=$3 JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE at.id=$1 AND at.student_id=$2 AND at.school_owner_id=$5 AND at.status='in_progress' AND at.deadline_at>now() ON CONFLICT(attempt_id,question_id) DO UPDATE SET answer=EXCLUDED.answer,updated_at=now() RETURNING question_id`,
      [
        c.req.param("attemptId"),
        context.studentId,
        c.req.param("questionId"),
        JSON.stringify(answer),
        context.schoolId,
      ],
    );
    return result.rowCount
      ? c.json({ saved: true })
      : c.json({ error: "Attempt is closed or question is unavailable." }, 409);
  });

  app.post("/api/lms/attempts/:attemptId/submit", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const a = await client.query(
        "SELECT id,assessment_id,status,deadline_at FROM school_lms_attempts WHERE id=$1 AND student_id=$2 AND school_owner_id=$3 FOR UPDATE",
        [c.req.param("attemptId"), context.studentId, context.schoolId],
      );
      if (!a.rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Attempt not found." }, 404);
      }
      if (a.rows[0].status !== "in_progress") {
        await client.query("COMMIT");
        return c.json({ submitted: true });
      }
      if (new Date(a.rows[0].deadline_at).getTime() <= Date.now()) {
        await client.query(
          "UPDATE school_lms_attempts SET status='submitted',submitted_at=deadline_at WHERE id=$1",
          [a.rows[0].id],
        );
      }
      await client.query(
        `INSERT INTO school_lms_attempt_answers(attempt_id,question_id,answer) SELECT $1,aq.question_id,'null'::jsonb FROM school_lms_assessment_questions aq WHERE aq.assessment_id=$2 ON CONFLICT(attempt_id,question_id) DO NOTHING`,
        [a.rows[0].id, a.rows[0].assessment_id],
      );
      await client.query(
        `UPDATE school_lms_attempt_answers aa SET marks_awarded=CASE WHEN q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank') AND lower(btrim(COALESCE(aa.answer#>>'{}',''))) = lower(btrim(COALESCE(q.answer_key#>>'{}',''))) THEN q.marks WHEN q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank') THEN 0 ELSE NULL END FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=$1 AND aa.attempt_id=$2 AND aa.question_id=q.id`,
        [a.rows[0].assessment_id, a.rows[0].id],
      );
      await client.query(
        `UPDATE school_lms_attempt_answers aa SET marks_awarded=0 FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=$1 AND aq.question_id=q.id AND aa.attempt_id=$2 AND aa.question_id=q.id AND aa.marks_awarded IS NULL AND q.question_type IN ('multiple_choice','true_false','short_answer','fill_blank')`,
        [a.rows[0].assessment_id, a.rows[0].id],
      );
      await client.query(
        `UPDATE school_lms_attempts SET status='submitted',submitted_at=now(),score=(SELECT COALESCE(sum(marks_awarded),0) FROM school_lms_attempt_answers WHERE attempt_id=$1) WHERE id=$1`,
        [a.rows[0].id],
      );
      await client.query("COMMIT");
      return c.json({ submitted: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/lms/auth/login", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const admission = String(body?.admissionNo || "").trim();
    const password = String(body?.password || "");
    const schoolName = String(body?.schoolName || "").trim();
    if (!admission || !password)
      return c.json({ error: "Admission number and password are required." }, 400);
    const candidates = await pool.query(
      `SELECT s.id,s.school_owner_id,s.admission_no,s.first_name,s.last_name,s.class_name,s.stream,
        a.password_hash,a.must_change_password,a.active,a.locked_until
       FROM school_students s JOIN school_lms_student_accounts a ON a.student_id=s.id AND a.school_owner_id=s.school_owner_id
       JOIN school_profiles p ON p.user_id=s.school_owner_id
       WHERE s.admission_no=$1 AND s.status='Active' AND a.active AND ($2='' OR lower(p.school_name)=lower($2)) LIMIT 2`,
      [admission, schoolName],
    );
    if (candidates.rowCount !== 1)
      return c.json(
        {
          error: candidates.rowCount
            ? "More than one school uses this admission number. Enter your school name to continue."
            : "Admission number or password is incorrect.",
        },
        401,
      );
    const student = candidates.rows[0];
    if (student.locked_until && new Date(student.locked_until) > new Date())
      return c.json(
        { error: "Too many failed attempts. Ask your school administrator to reset access." },
        429,
      );
    if (!(await verifyStudentPassword(password, student.password_hash))) {
      await pool.query(
        `UPDATE school_lms_student_accounts SET failed_login_count=failed_login_count+1,
         locked_until=CASE WHEN failed_login_count+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE student_id=$1`,
        [student.id],
      );
      return c.json({ error: "Admission number or password is incorrect." }, 401);
    }
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      "UPDATE school_lms_student_accounts SET session_hash=$2,session_expires_at=now()+interval '24 hours',last_login_at=now(),failed_login_count=0,locked_until=NULL,updated_at=now() WHERE student_id=$1",
      [student.id, hashToken(token)],
    );
    return c.json({
      token: `stu.${token}`,
      mustChangePassword: student.must_change_password,
      student: {
        id: student.id,
        admissionNo: student.admission_no,
        firstName: student.first_name,
        lastName: student.last_name,
        className: student.class_name,
        stream: student.stream,
      },
    });
  });

  app.post("/api/lms/parent/auth/login", async (c) => {
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = String(b?.email || "")
        .trim()
        .toLowerCase(),
      password = String(b?.password || ""),
      school = String(b?.schoolName || "").trim();
    if (!email || !password)
      return c.json({ error: "Parent email and password are required." }, 400);
    const rows = await pool.query(
      `SELECT a.*,p.school_name FROM school_lms_parent_accounts a JOIN school_profiles p ON p.user_id=a.school_owner_id WHERE a.email=$1 AND a.active AND ($2='' OR lower(p.school_name)=lower($2)) LIMIT 2`,
      [email, school],
    );
    if (rows.rowCount !== 1)
      return c.json(
        {
          error: rows.rowCount
            ? "More than one school has a parent account for this email. Enter the school name."
            : "Email or password is incorrect.",
        },
        401,
      );
    const account = rows.rows[0];
    if (account.locked_until && new Date(account.locked_until) > new Date())
      return c.json(
        { error: "Too many failed attempts. Ask your school to reset parent access." },
        429,
      );
    if (!(await verifyStudentPassword(password, account.password_hash))) {
      await pool.query(
        "UPDATE school_lms_parent_accounts SET failed_login_count=failed_login_count+1,locked_until=CASE WHEN failed_login_count+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1",
        [account.id],
      );
      return c.json({ error: "Email or password is incorrect." }, 401);
    }
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      "UPDATE school_lms_parent_accounts SET session_hash=$2,session_expires_at=now()+interval '24 hours',failed_login_count=0,locked_until=NULL,updated_at=now() WHERE id=$1",
      [account.id, hashToken(token)],
    );
    return c.json({
      token: `par.${token}`,
      mustChangePassword: account.must_change_password,
      parent: { name: account.full_name, email: account.email, schoolName: account.school_name },
    });
  });

  app.post("/api/lms/parent/auth/change-password", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.parentId) return c.json({ error: "Parent account required." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const current = String(b?.currentPassword || ""),
      next = String(b?.newPassword || "");
    if (next.length < 10 || next.length > 128)
      return c.json({ error: "New password must be 10 to 128 characters." }, 400);
    const row = await pool.query(
      "SELECT password_hash FROM school_lms_parent_accounts WHERE id=$1 AND school_owner_id=$2",
      [context.parentId, context.schoolId],
    );
    if (!row.rowCount || !(await verifyStudentPassword(current, row.rows[0].password_hash)))
      return c.json({ error: "Current password is incorrect." }, 401);
    await pool.query(
      "UPDATE school_lms_parent_accounts SET password_hash=$2,must_change_password=false,updated_at=now() WHERE id=$1",
      [context.parentId, await hashStudentPassword(next)],
    );
    return c.json({ updated: true });
  });

  app.get("/api/lms/parent/me", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.parentId) return c.json({ error: "Parent account required." }, 403);
    const result = await pool.query(
      'SELECT email,full_name AS name,must_change_password AS "mustChangePassword" FROM school_lms_parent_accounts WHERE id=$1 AND school_owner_id=$2',
      [context.parentId, context.schoolId],
    );
    return result.rowCount
      ? c.json(result.rows[0])
      : c.json({ error: "Parent account not found." }, 404);
  });

  app.post("/api/lms/parent/auth/logout", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.parentId) return c.json({ error: "Parent account required." }, 403);
    await pool.query(
      "UPDATE school_lms_parent_accounts SET session_hash=NULL,session_expires_at=NULL WHERE id=$1",
      [context.parentId],
    );
    return c.json({ loggedOut: true });
  });

  app.get("/api/lms/parent/progress", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.parentId || context.role !== "Parent")
      return c.json({ error: "Parent account required." }, 403);
    const students = await pool.query(
      `SELECT s.id,s.first_name AS "firstName",s.last_name AS "lastName",s.admission_no AS "admissionNo",s.class_name AS "className",s.stream FROM school_lms_parent_students ps JOIN school_students s ON s.id=ps.student_id AND s.school_owner_id=ps.school_owner_id JOIN school_lms_parent_accounts pa ON pa.id=ps.parent_id AND pa.school_owner_id=ps.school_owner_id WHERE ps.parent_id=$1 AND ps.school_owner_id=$2 AND s.status='Active' AND lower(s.guardian_email)=pa.email ORDER BY s.last_name,s.first_name`,
      [context.parentId, context.schoolId],
    );
    const ids = students.rows.map((row) => row.id);
    const activity = await pool.query(
      `SELECT s.id AS "studentId",count(m.id)::int AS "materialsAvailable",count(pr.completed_at)::int AS "materialsCompleted",COALESCE(sum(pr.seconds_viewed),0)::int AS "secondsViewed",COALESCE(sum(pr.download_count),0)::int AS "downloads" FROM school_students s LEFT JOIN school_classes cl ON cl.school_owner_id=s.school_owner_id AND cl.name=s.class_name LEFT JOIN school_lms_materials m ON m.school_owner_id=s.school_owner_id AND m.class_id=cl.id AND m.publication_status='published' AND (m.stream='*' OR m.stream=s.stream) AND cl.subjects ? m.subject LEFT JOIN school_lms_progress pr ON pr.student_id=s.id AND pr.material_id=m.id WHERE s.id=ANY($1::uuid[]) AND s.school_owner_id=$2 GROUP BY s.id`,
      [ids, context.schoolId],
    );
    const assignments = await pool.query(
      `SELECT sub.student_id AS "studentId",a.title,a.subject,a.due_at AS "dueAt",sub.status,sub.marks,sub.feedback,sub.submitted_at AS "submittedAt" FROM school_lms_submissions sub JOIN school_lms_assignments a ON a.id=sub.assignment_id AND a.school_owner_id=sub.school_owner_id WHERE sub.school_owner_id=$1 AND sub.student_id=ANY($2::uuid[]) ORDER BY sub.submitted_at DESC LIMIT 300`,
      [context.schoolId, ids],
    );
    const exams = await pool.query(
      `SELECT m.student_id AS "studentId",e.name AS exam,e.term,e.academic_year AS "academicYear",m.subject,m.score FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.school_owner_id=$1 AND m.student_id=ANY($2::uuid[]) AND m.status='Approved' ORDER BY e.created_at DESC,m.subject`,
      [context.schoolId, ids],
    );
    const assessments = await pool.query(
      `SELECT at.student_id AS "studentId",a.title,a.subject,at.score,(SELECT COALESCE(sum(q.marks),0) FROM school_lms_assessment_questions aq JOIN school_lms_question_bank q ON q.id=aq.question_id WHERE aq.assessment_id=a.id) AS "maxMarks",at.submitted_at AS "submittedAt" FROM school_lms_attempts at JOIN school_lms_assessments a ON a.id=at.assessment_id AND a.school_owner_id=at.school_owner_id WHERE at.school_owner_id=$1 AND at.student_id=ANY($2::uuid[]) AND a.results_released AND at.status IN ('submitted','marked') ORDER BY at.submitted_at DESC`,
      [context.schoolId, ids],
    );
    return c.json({
      students: students.rows.map((student) => ({
        ...student,
        activity: activity.rows.find((row) => row.studentId === student.id) || {
          materialsAvailable: 0,
          materialsCompleted: 0,
          secondsViewed: 0,
          downloads: 0,
        },
        assignments: assignments.rows.filter((row) => row.studentId === student.id),
        exams: exams.rows.filter((row) => row.studentId === student.id),
        assessments: assessments.rows.filter((row) => row.studentId === student.id),
      })),
    });
  });

  app.post("/api/lms/parent-accounts/generate", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context || context.role !== "Admin")
      return c.json({ error: "Only the school administrator can create parent access." }, 403);
    const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = String(b?.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return c.json({ error: "Enter a valid guardian email." }, 400);
    const linked = await pool.query(
      `SELECT id,first_name AS "firstName",last_name AS "lastName",class_name AS "className" FROM school_students WHERE school_owner_id=$1 AND status='Active' AND lower(guardian_email)=$2 ORDER BY last_name,first_name`,
      [context.schoolId, email],
    );
    if (!linked.rowCount)
      return c.json(
        { error: "No active student has this guardian email. Add it to the student record first." },
        404,
      );
    const temp = randomBytes(12).toString("base64url"),
      hash = await hashStudentPassword(temp),
      name = String(b?.name || "")
        .trim()
        .slice(0, 180);
    const client = await pool.connect();
    let parentId = "";
    try {
      await client.query("BEGIN");
      const account = await client.query(
        `INSERT INTO school_lms_parent_accounts(school_owner_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(school_owner_id,email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,active=true,must_change_password=true,session_hash=NULL,session_expires_at=NULL,failed_login_count=0,locked_until=NULL,updated_at=now() RETURNING id`,
        [context.schoolId, email, name, hash],
      );
      parentId = account.rows[0].id;
      await client.query("DELETE FROM school_lms_parent_students WHERE parent_id=$1", [parentId]);
      for (const student of linked.rows)
        await client.query(
          "INSERT INTO school_lms_parent_students(parent_id,school_owner_id,student_id) VALUES($1,$2,$3)",
          [parentId, context.schoolId, student.id],
        );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return c.json({ email, temporaryPassword: temp, students: linked.rows }, 201);
  });

  app.get("/api/lms/accounts", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context || context.role !== "Admin")
      return c.json(
        { error: "Only the school administrator can manage student LMS accounts." },
        403,
      );
    const className = c.req.query("class") || "";
    const result = await pool.query(
      `SELECT s.id,s.admission_no AS "admissionNo",s.first_name AS "firstName",s.last_name AS "lastName",s.class_name AS "className",s.stream,
        (a.student_id IS NOT NULL AND a.active) AS "accountActive",COALESCE(a.must_change_password,false) AS "mustChangePassword",a.last_login_at AS "lastLoginAt"
       FROM school_students s LEFT JOIN school_lms_student_accounts a ON a.student_id=s.id AND a.school_owner_id=s.school_owner_id
       WHERE s.school_owner_id=$1 AND s.status='Active' AND ($2='' OR s.class_name=$2)
       ORDER BY s.class_name,s.stream,s.last_name,s.first_name LIMIT 1000`,
      [context.schoolId, className],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/accounts/generate", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context || context.role !== "Admin")
      return c.json(
        { error: "Only the school administrator can generate student passwords." },
        403,
      );
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const className = String(body?.className || "").trim();
    const stream = String(body?.stream || "").trim();
    const selected = Array.isArray(body?.studentIds)
      ? body.studentIds.map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      : [];
    if (!className && !selected.length)
      return c.json({ error: "Choose a class or select students." }, 400);
    const students = await pool.query(
      `SELECT id,admission_no AS "admissionNo",first_name AS "firstName",last_name AS "lastName",class_name AS "className",stream
       FROM school_students WHERE school_owner_id=$1 AND status='Active' AND ($2='' OR class_name=$2) AND ($3='' OR stream=$3)
         AND (cardinality($4::uuid[])=0 OR id=ANY($4::uuid[])) ORDER BY class_name,stream,last_name,first_name LIMIT 500`,
      [context.schoolId, className, stream, selected],
    );
    if (!students.rowCount)
      return c.json({ error: "No active students matched the selection." }, 404);
    const credentials: {
      admissionNo: string;
      firstName: string;
      lastName: string;
      className: string;
      stream: string;
      password: string;
    }[] = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const student of students.rows) {
        const password = randomBytes(9).toString("base64url");
        const digest = await hashStudentPassword(password);
        await client.query(
          `INSERT INTO school_lms_student_accounts(school_owner_id,student_id,password_hash,must_change_password,active,session_hash,session_expires_at)
           VALUES($1,$2,$3,false,true,NULL,NULL) ON CONFLICT(student_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,must_change_password=false,active=true,session_hash=NULL,session_expires_at=NULL,failed_login_count=0,locked_until=NULL,updated_at=now()`,
          [context.schoolId, student.id, digest],
        );
        credentials.push({
          admissionNo: student.admissionNo,
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.className,
          stream: student.stream,
          password,
        });
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return c.json(
      {
        credentials,
        notice:
          "Save or download this password sheet now. These passwords do not require a first-login change.",
      },
      201,
    );
  });

  app.post("/api/lms/auth/change-password", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const current = String(body?.currentPassword || "");
    const nextPassword = String(body?.newPassword || "");
    if (nextPassword.length < 10 || nextPassword.length > 128)
      return c.json({ error: "New password must be between 10 and 128 characters." }, 400);
    const account = await pool.query(
      "SELECT password_hash FROM school_lms_student_accounts WHERE student_id=$1 AND active",
      [context.studentId],
    );
    if (!account.rowCount || !(await verifyStudentPassword(current, account.rows[0].password_hash)))
      return c.json({ error: "Current password is incorrect." }, 401);
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      "UPDATE school_lms_student_accounts SET password_hash=$2,must_change_password=false,session_hash=$3,session_expires_at=now()+interval '24 hours',updated_at=now() WHERE student_id=$1",
      [context.studentId, await hashStudentPassword(nextPassword), hashToken(token)],
    );
    return c.json({ token: `stu.${token}` });
  });

  app.post("/api/lms/auth/logout", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    await pool.query(
      "UPDATE school_lms_student_accounts SET session_hash=NULL,session_expires_at=NULL WHERE student_id=$1",
      [context.studentId],
    );
    return c.json({ ok: true });
  });

  app.get("/api/lms/student/me", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const result = await pool.query(
      `SELECT s.id,s.admission_no AS "admissionNo",s.first_name AS "firstName",s.last_name AS "lastName",s.class_name AS "className",s.stream,
        cl.id AS "classId",cl.subjects,p.school_name AS "schoolName",p.academic_year AS "academicYear",p.active_term AS "activeTerm",a.must_change_password AS "mustChangePassword"
       FROM school_students s JOIN school_profiles p ON p.user_id=s.school_owner_id JOIN school_lms_student_accounts a ON a.student_id=s.id
       LEFT JOIN school_classes cl ON cl.school_owner_id=s.school_owner_id AND cl.name=s.class_name
       WHERE s.id=$1 AND s.school_owner_id=$2 AND s.status='Active'`,
      [context.studentId, context.schoolId],
    );
    return result.rowCount
      ? c.json(result.rows[0])
      : c.json({ error: "Student record not found." }, 404);
  });

  app.get("/api/lms/student/report-card", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const result = await pool.query(
      `WITH cohort_scores AS (
      SELECT e.id AS "examId",e.name AS exam,e.term,e.academic_year AS "academicYear",e.created_at AS "examDate",s.id AS "studentId",s.first_name AS "firstName",s.last_name AS "lastName",s.admission_no AS "admissionNo",s.class_name AS "className",s.stream,p.school_name AS "schoolName",COALESCE(sum(m.score),0)::numeric AS total,COALESCE(round(avg(m.score),1),0)::numeric AS average,COALESCE(jsonb_object_agg(m.subject,m.score) FILTER(WHERE m.id IS NOT NULL),'{}'::jsonb) AS subjects,count(m.id)::int AS "subjectCount"
      FROM school_students selected JOIN school_students s ON s.school_owner_id=selected.school_owner_id AND s.class_name=selected.class_name AND s.status='Active'
      JOIN school_exams e ON e.school_owner_id=s.school_owner_id AND e.class_name=s.class_name AND (e.stream='*' OR e.stream=s.stream)
      JOIN school_profiles p ON p.user_id=s.school_owner_id
      LEFT JOIN school_marks m ON m.exam_id=e.id AND m.student_id=s.id AND m.status='Approved'
      WHERE selected.id=$1 AND selected.school_owner_id=$2 AND selected.status='Active'
      GROUP BY e.id,s.id,p.school_name
    ), ranked AS (SELECT *,DENSE_RANK() OVER(PARTITION BY "examId" ORDER BY total DESC) AS position,COUNT(*) OVER(PARTITION BY "examId") AS "classSize" FROM cohort_scores)
    SELECT "examId",exam,term,"academicYear","examDate","firstName","lastName","admissionNo","className",stream,"schoolName",total,average,subjects,position,"classSize" FROM ranked WHERE "studentId"=$1 AND "subjectCount">0 ORDER BY "examDate","examId"`,
      [context.studentId, context.schoolId],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/materials/:id/activity", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const seconds = Math.max(0, Math.min(3600, Math.floor(Number(body?.secondsViewed) || 0)));
    const completed = body?.completed === true;
    const result = await pool.query(
      `INSERT INTO school_lms_progress(school_owner_id,student_id,material_id,seconds_viewed,completed_at)
       SELECT m.school_owner_id,$2,m.id,$3,CASE WHEN $4 THEN now() ELSE NULL END FROM school_lms_materials m
       JOIN school_classes cl ON cl.id=m.class_id AND cl.school_owner_id=m.school_owner_id
       JOIN school_students s ON s.id=$2 AND s.school_owner_id=m.school_owner_id AND s.class_name=cl.name AND s.status='Active'
       WHERE m.id=$1 AND m.publication_status='published' AND (m.stream='*' OR m.stream=s.stream) AND cl.subjects ? m.subject
       ON CONFLICT(student_id,material_id) DO UPDATE SET last_activity_at=now(),seconds_viewed=school_lms_progress.seconds_viewed+EXCLUDED.seconds_viewed,completed_at=COALESCE(school_lms_progress.completed_at,EXCLUDED.completed_at)
       RETURNING material_id AS "materialId",opened_at AS "openedAt",last_activity_at AS "lastActivityAt",completed_at AS "completedAt",seconds_viewed AS "secondsViewed"`,
      [c.req.param("id"), context.studentId, seconds, completed],
    );
    if (!result.rowCount)
      return c.json({ error: "Learning material is not available to this student." }, 404);
    return c.json(result.rows[0]);
  });

  app.get("/api/lms/student/progress", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const result = await pool.query(
      `SELECT m.id AS "materialId",m.title,m.subject,m.material_type AS type,m.created_by_name AS "teacherName",
        p.opened_at AS "openedAt",p.last_activity_at AS "lastActivityAt",p.completed_at AS "completedAt",p.seconds_viewed AS "secondsViewed",p.download_count AS "downloadCount"
       FROM school_lms_materials m JOIN school_classes cl ON cl.id=m.class_id AND cl.school_owner_id=m.school_owner_id
       JOIN school_students s ON s.id=$2 AND s.school_owner_id=m.school_owner_id AND s.class_name=cl.name AND s.status='Active'
       LEFT JOIN school_lms_progress p ON p.material_id=m.id AND p.student_id=s.id
       WHERE m.school_owner_id=$1 AND m.publication_status='published' AND (m.stream='*' OR m.stream=s.stream) AND cl.subjects ? m.subject
       ORDER BY p.last_activity_at DESC NULLS LAST,m.created_at DESC LIMIT 200`,
      [context.schoolId, context.studentId],
    );
    return c.json(result.rows);
  });

  app.get("/api/lms/assignments", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to view assignments." }, 403);
    const result = await pool.query(
      `SELECT a.id,a.class_id AS "classId",cl.name AS "className",a.subject,a.stream,a.topic_id AS "topicId",t.title AS topic,
        a.title,a.instructions,a.term,a.academic_year AS "academicYear",a.due_at AS "dueAt",a.max_marks AS "maxMarks",a.allow_late AS "allowLate",a.allow_resubmit AS "allowResubmit",
        a.publication_status AS status,a.created_by_name AS "createdByName",a.created_at AS "createdAt",
        sub.id AS "submissionId",sub.response_text AS "responseText",sub.file_name AS "fileName",sub.status AS "submissionStatus",sub.marks,sub.feedback,sub.submitted_at AS "submittedAt"
       FROM school_lms_assignments a JOIN school_classes cl ON cl.id=a.class_id AND cl.school_owner_id=a.school_owner_id
       LEFT JOIN school_lms_topics t ON t.id=a.topic_id AND t.school_owner_id=a.school_owner_id
       LEFT JOIN school_lms_submissions sub ON sub.assignment_id=a.id AND sub.student_id=$4::uuid
       WHERE a.school_owner_id=$1 AND (
         $2='Admin' OR
         ($2='Student' AND a.publication_status='published' AND EXISTS(SELECT 1 FROM school_students s WHERE s.id=$4::uuid AND s.school_owner_id=a.school_owner_id AND s.class_name=cl.name AND s.status='Active' AND (a.stream='*' OR a.stream=s.stream) AND cl.subjects ? a.subject)) OR
         ($2='Teacher' AND EXISTS(SELECT 1 FROM school_teacher_assignments ta WHERE ta.school_owner_id=a.school_owner_id AND ta.user_id=$3 AND ta.class_id=a.class_id AND (a.stream='*' OR ta.stream=a.stream) AND ta.subjects ? a.subject)))
       ORDER BY a.due_at NULLS LAST,a.created_at DESC LIMIT 300`,
      [context.schoolId, context.role, c.get("userId"), context.studentId || null],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/assignments", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to create assignments." }, 403);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const classId = String(body?.classId || "");
    const subject = String(body?.subject || "").trim();
    const stream = String(body?.stream || "*");
    const title = String(body?.title || "").trim();
    const instructions = String(body?.instructions || "").trim();
    const term = String(body?.term || "").trim();
    const academicYear = String(body?.academicYear || "").trim();
    const maxMarks = Number(body?.maxMarks || 0);
    const dueAt = body?.dueAt ? new Date(String(body.dueAt)) : null;
    const status = String(body?.status || "draft");
    if (
      !classId ||
      !subject ||
      !title ||
      title.length > 180 ||
      instructions.length > 10000 ||
      !Number.isFinite(maxMarks) ||
      maxMarks <= 0 ||
      (dueAt && !Number.isFinite(dueAt.getTime())) ||
      !(status === "draft" || status === "published")
    )
      return c.json(
        {
          error:
            "Provide a class, subject, assignment title, valid due date, and positive maximum marks.",
        },
        400,
      );
    if (stream === "*" && context.role !== "Admin")
      return c.json({ error: "Teachers must select one of their assigned streams." }, 403);
    if (!(await canManageLearning(context, c.get("userId"), classId, subject, stream)))
      return c.json({ error: "You are not assigned to this class, stream, and subject." }, 403);
    const result = await pool.query(
      `INSERT INTO school_lms_assignments(school_owner_id,class_id,subject,stream,topic_id,title,instructions,term,academic_year,due_at,max_marks,allow_late,allow_resubmit,publication_status,created_by,created_by_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id,class_id AS "classId",subject,stream,title,instructions,term,academic_year AS "academicYear",due_at AS "dueAt",max_marks AS "maxMarks",allow_late AS "allowLate",allow_resubmit AS "allowResubmit",publication_status AS status,created_at AS "createdAt"`,
      [
        context.schoolId,
        classId,
        subject,
        stream,
        String(body?.topicId || "") || null,
        title,
        instructions,
        term,
        academicYear,
        dueAt?.toISOString() || null,
        maxMarks,
        body?.allowLate === true,
        body?.allowResubmit !== false,
        status,
        c.get("userId"),
        context.name,
      ],
    );
    return c.json(result.rows[0], 201);
  });

  app.post("/api/lms/assignments/:id/submit", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context?.studentId || context.role !== "Student")
      return c.json({ error: "Student account required." }, 403);
    const form = await c.req.formData().catch(() => null);
    if (!form) return c.json({ error: "Submit your assignment as a form." }, 400);
    const responseText = String(form.get("responseText") || "").trim();
    const upload = form.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (responseText.length > 20000 || (!responseText && !file))
      return c.json(
        { error: "Add written work (up to 20000 characters), an attachment, or both." },
        400,
      );
    if (file && file.size > 20 * 1024 * 1024)
      return c.json({ error: "Assignment files are limited to 20 MB." }, 413);
    const allowedTypes: Record<string, string[]> = {
      pdf: ["application/pdf"],
      doc: ["application/msword"],
      docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ppt: ["application/vnd.ms-powerpoint"],
      pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      xls: ["application/vnd.ms-excel"],
      xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
      png: ["image/png"],
      webp: ["image/webp"],
      txt: ["text/plain"],
      zip: ["application/zip", "application/x-zip-compressed"],
    };
    const extension = file?.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file?.type.toLowerCase() || "";
    if (file && !allowedTypes[extension]?.includes(mimeType))
      return c.json(
        { error: "Attach a PDF, Office document, JPG/PNG/WEBP, ZIP, or text file." },
        415,
      );
    const assignment = await pool.query(
      `SELECT a.id,a.allow_late,a.allow_resubmit,a.due_at FROM school_lms_assignments a JOIN school_classes cl ON cl.id=a.class_id AND cl.school_owner_id=a.school_owner_id
       JOIN school_students s ON s.id=$2 AND s.school_owner_id=a.school_owner_id AND s.class_name=cl.name AND s.status='Active' AND (a.stream='*' OR a.stream=s.stream) AND cl.subjects ? a.subject
       WHERE a.id=$1 AND a.school_owner_id=$3 AND a.publication_status='published'`,
      [c.req.param("id"), context.studentId, context.schoolId],
    );
    if (!assignment.rowCount)
      return c.json({ error: "Assignment not available to this student." }, 404);
    if (
      assignment.rows[0].due_at &&
      new Date(assignment.rows[0].due_at) < new Date() &&
      !assignment.rows[0].allow_late
    )
      return c.json({ error: "The due date has passed." }, 409);
    const prior = await pool.query(
      "SELECT id,file_key,file_name FROM school_lms_submissions WHERE assignment_id=$1 AND student_id=$2",
      [c.req.param("id"), context.studentId],
    );
    if (prior.rowCount && !assignment.rows[0].allow_resubmit)
      return c.json(
        { error: "This assignment has already been submitted and resubmission is disabled." },
        409,
      );
    let key = prior.rows[0]?.file_key || "";
    if (file) {
      key = `learning-submissions/${context.schoolId}/${c.req.param("id")}/${randomUUID()}.${extension}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: imageBucket,
          Key: key,
          Body: new Uint8Array(await file.arrayBuffer()),
          ContentType: mimeType,
        }),
      );
    }
    let result;
    try {
      result = await pool.query(
        `INSERT INTO school_lms_submissions(school_owner_id,assignment_id,student_id,response_text,file_key,file_name,status)
         VALUES($1,$2,$3,$4,$5,$6,'submitted') ON CONFLICT(assignment_id,student_id) DO UPDATE
         SET response_text=EXCLUDED.response_text,file_key=EXCLUDED.file_key,file_name=EXCLUDED.file_name,status='submitted',marks=NULL,feedback='',submitted_at=now(),marked_by=NULL,marked_at=NULL
         WHERE $7::boolean RETURNING id,status,submitted_at AS "submittedAt"`,
        [
          context.schoolId,
          c.req.param("id"),
          context.studentId,
          responseText,
          key,
          file?.name.slice(0, 255) || prior.rows[0]?.file_name || "",
          assignment.rows[0].allow_resubmit || !prior.rowCount,
        ],
      );
    } catch (error) {
      if (file)
        await s3
          .send(new DeleteObjectCommand({ Bucket: imageBucket, Key: key }))
          .catch(() => undefined);
      throw error;
    }
    if (!result.rowCount)
      return c.json(
        { error: "This assignment has already been submitted and resubmission is disabled." },
        409,
      );
    if (file && prior.rows[0]?.file_key && prior.rows[0].file_key !== key)
      await s3
        .send(new DeleteObjectCommand({ Bucket: imageBucket, Key: prior.rows[0].file_key }))
        .catch((error) => console.error("Could not remove replaced assignment submission", error));
    return c.json(result.rows[0], 201);
  });

  app.get("/api/lms/submissions/:id/download", async (c) => {
    const context = await guard(c, "view_lms");
    if (!context) return c.json({ error: "Not allowed to access this submission." }, 403);
    const row = await pool.query(
      `SELECT sub.file_key,sub.file_name,a.class_id,a.subject,a.stream,sub.student_id FROM school_lms_submissions sub JOIN school_lms_assignments a ON a.id=sub.assignment_id AND a.school_owner_id=sub.school_owner_id WHERE sub.id=$1 AND sub.school_owner_id=$2 AND sub.file_key<>''`,
      [c.req.param("id"), context.schoolId],
    );
    if (!row.rowCount) return c.json({ error: "Submission file not found." }, 404);
    if (context.role === "Student" && row.rows[0].student_id !== context.studentId)
      return c.json({ error: "Submission file not found." }, 404);
    if (
      context.role === "Teacher" &&
      !(await canManageLearning(
        context,
        c.get("userId"),
        row.rows[0].class_id,
        row.rows[0].subject,
        row.rows[0].stream,
      ))
    )
      return c.json({ error: "Submission file not found." }, 404);
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: imageBucket, Key: row.rows[0].file_key }),
      { expiresIn: 300 },
    );
    return c.json({ url, fileName: row.rows[0].file_name });
  });

  app.get("/api/lms/assignments/:id/submissions", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to view assignment submissions." }, 403);
    const assignment = await pool.query(
      "SELECT class_id,subject,stream FROM school_lms_assignments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (
      !assignment.rowCount ||
      !(await canManageLearning(
        context,
        c.get("userId"),
        assignment.rows[0].class_id,
        assignment.rows[0].subject,
        assignment.rows[0].stream,
      ))
    )
      return c.json({ error: "Assignment not found or outside your permissions." }, 404);
    const result = await pool.query(
      `SELECT sub.id,sub.student_id AS "studentId",s.admission_no AS "admissionNo",s.first_name AS "firstName",s.last_name AS "lastName",sub.response_text AS "responseText",sub.file_name AS "fileName",sub.status,sub.marks,sub.feedback,sub.submitted_at AS "submittedAt"
       FROM school_lms_submissions sub JOIN school_students s ON s.id=sub.student_id AND s.school_owner_id=sub.school_owner_id
       WHERE sub.school_owner_id=$1 AND sub.assignment_id=$2 ORDER BY s.last_name,s.first_name`,
      [context.schoolId, c.req.param("id")],
    );
    return c.json(result.rows);
  });

  app.post("/api/lms/assignments/:id/submissions/:submissionId/mark", async (c) => {
    const context = await guard(c, "manage_lms");
    if (!context) return c.json({ error: "Not allowed to mark assignments." }, 403);
    const assignment = await pool.query(
      "SELECT class_id,subject,stream,max_marks FROM school_lms_assignments WHERE id=$1 AND school_owner_id=$2",
      [c.req.param("id"), context.schoolId],
    );
    if (
      !assignment.rowCount ||
      !(await canManageLearning(
        context,
        c.get("userId"),
        assignment.rows[0].class_id,
        assignment.rows[0].subject,
        assignment.rows[0].stream,
      ))
    )
      return c.json({ error: "Assignment not found or outside your permissions." }, 404);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const marks = Number(body?.marks);
    const feedback = String(body?.feedback || "").trim();
    if (
      !Number.isFinite(marks) ||
      marks < 0 ||
      marks > Number(assignment.rows[0].max_marks) ||
      feedback.length > 5000
    )
      return c.json(
        { error: "Enter marks within the assignment maximum and feedback up to 5000 characters." },
        400,
      );
    const result = await pool.query(
      `UPDATE school_lms_submissions SET marks=$4,feedback=$5,status='marked',marked_by=$6,marked_at=now()
       WHERE id=$1 AND assignment_id=$2 AND school_owner_id=$3 RETURNING id,status,marks,feedback,marked_at AS "markedAt"`,
      [
        c.req.param("submissionId"),
        c.req.param("id"),
        context.schoolId,
        marks,
        feedback,
        c.get("userId"),
      ],
    );
    return result.rowCount
      ? c.json(result.rows[0])
      : c.json({ error: "Submission not found." }, 404);
  });
}
