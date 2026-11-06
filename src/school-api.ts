import type { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool } from "pg";
import { parseTriggerDelivery } from "@neon/functions/triggers";

type ApiEnv = { Variables: { userId: string; userEmail: string; userName: string } };
type Context = { schoolId: string; role: string; permissions: string[]; name: string };
type Permission = "view_students" | "edit_students" | "view_fees" | "edit_fees" | "manage_staff" | "view_classes" | "edit_classes" | "manage_settings" | "view_announcements" | "manage_announcements" | "view_attendance" | "edit_attendance" | "view_exams" | "edit_exams";
const allPermissions: Permission[] = ["view_students","edit_students","view_fees","edit_fees","manage_staff","view_classes","edit_classes","manage_settings","view_announcements","manage_announcements","view_attendance","edit_attendance","view_exams","edit_exams"];
const s3 = new S3Client({ forcePathStyle: true });
const imageBucket = "assets";
const rolePermissions: Record<string, Permission[]> = {
  Admin: allPermissions,
  Teacher: ["view_students","view_classes","view_announcements","view_attendance","edit_attendance","view_exams","edit_exams"],
  Accountant: ["view_students","view_fees","edit_fees","view_classes","view_announcements"],
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char] || char);
}
export function mountSchoolApi(app: Hono<ApiEnv>, pool: Pool) {
  async function contextFor(c: any): Promise<Context | null> {
    const userId = c.get("userId") as string;
    const staff = await pool.query("SELECT school_owner_id, role, permissions, full_name FROM school_staff WHERE user_id = $1 AND active = true", [userId]);
    if (staff.rowCount) {
      const row = staff.rows[0];
      return { schoolId: row.school_owner_id, role: row.role, permissions: row.permissions ?? [], name: row.full_name };
    }
    const owned = await pool.query("SELECT user_id, school_name FROM school_profiles WHERE user_id = $1", [userId]);
    if (!owned.rowCount) return null;
    await pool.query(
      "INSERT INTO school_staff (user_id, school_owner_id, email, full_name, role, permissions) VALUES ($1,$1,$2,$3,'Admin',$4::jsonb) ON CONFLICT (user_id) DO NOTHING",
      [userId, c.get("userEmail"), c.get("userName") || owned.rows[0].school_name, JSON.stringify(allPermissions)],
    );
    return { schoolId: userId, role: "Admin", permissions: allPermissions, name: c.get("userName") || owned.rows[0].school_name };
  }
  async function syncAutomaticTerm(schoolId: string) {
    const q=await pool.query("SELECT academic_year,active_term,term1_start_date,term1_end_date,term2_start_date,term2_end_date,term3_start_date,term3_end_date FROM school_profiles WHERE user_id=$1",[schoolId]);
    if(!q.rowCount)return;
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const part=(k:string)=>parts.find(p=>p.type===k)?.value||"";
    const today=part("year")+"-"+part("month")+"-"+part("day"), row=q.rows[0];
    let n=0; for(const i of [1,2,3]){const a=row["term"+i+"_start_date"],b=row["term"+i+"_end_date"];if(a&&b&&today>=String(a).slice(0,10)&&today<=String(b).slice(0,10)){n=i;break}}
    if(!n||row.active_term==="Term "+n)return;
    const term="Term "+n, year=String(row.academic_year||"");
    const client=await pool.connect();
    try{await client.query("BEGIN");const locked=await client.query("SELECT active_term FROM school_profiles WHERE user_id=$1 FOR UPDATE",[schoolId]);if(!locked.rowCount||locked.rows[0].active_term===term){await client.query("COMMIT");return}
      await client.query("UPDATE school_profiles SET active_term=$2,updated_at=now() WHERE user_id=$1",[schoolId,term]);
      if(year){const number=n,key="term"+n+"Fee",current=term+" "+year;await client.query("INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment) SELECT s.school_owner_id,s.id,$2,'Fee obligation',COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric,CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)+COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee),c.name||' term fees' FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees')",[schoolId,current,key,number])}
      await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
  }
  async function guard(c: any, permission: Permission): Promise<Context | null> {
    const context = await contextFor(c);
    if (!context) { c.status(403); c.header("content-type", "application/json"); return null; }
    await syncAutomaticTerm(context.schoolId);
    if (context.role !== "Admin" && !context.permissions.includes(permission)) { c.status(403); c.header("content-type", "application/json"); return null; }
    return context;
  }

  app.post("/internal/sync-school-terms", async (c) => {
    const parsed=await parseTriggerDelivery(c.req.raw);
    if(parsed.ok===false)return c.json({error:parsed.error},parsed.error==="invalid_body"?400:401);
    if(parsed.invocation.type!=="schedule")return c.json({error:"Schedule trigger required."},400);
    const schools=await pool.query("SELECT user_id FROM school_profiles");
    for(const school of schools.rows)await syncAutomaticTerm(school.user_id);
    return c.json({schoolsChecked:schools.rowCount||0});
  });
  app.get("/api/me", async (c) => {
    const context = await contextFor(c);
    if (!context) return c.json({ error: "This account is not attached to a school." }, 403);
    const profile = await pool.query(`SELECT school_name, school_type, contact_email, phone, address, website, motto, vision, logo_key, academic_year AS "academicYear", active_term AS "activeTerm", term1_start_date AS "term1StartDate", term1_end_date AS "term1EndDate", term2_start_date AS "term2StartDate", term2_end_date AS "term2EndDate", term3_start_date AS "term3StartDate", term3_end_date AS "term3EndDate" FROM school_profiles WHERE user_id = $1`, [context.schoolId]);
    const school = profile.rows[0] ?? null; if (school?.logo_key) { school.logoUrl = await getSignedUrl(s3,new GetObjectCommand({Bucket:imageBucket,Key:school.logo_key}),{expiresIn:3600}); delete school.logo_key; } return c.json({ userId: c.get("userId"), email: c.get("userEmail"), name: context.name, role: context.role, permissions: context.permissions, school });
  });

  app.get("/api/school-profile", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to view school settings." }, 403);
    const result = await pool.query(`SELECT school_name, school_type, contact_email, phone, address, website, motto, vision, logo_key, academic_year AS "academicYear", active_term AS "activeTerm", term1_start_date AS "term1StartDate", term1_end_date AS "term1EndDate", term2_start_date AS "term2StartDate", term2_end_date AS "term2EndDate", term3_start_date AS "term3StartDate", term3_end_date AS "term3EndDate" FROM school_profiles WHERE user_id = $1`, [context.schoolId]);
    const profile = result.rows[0] ?? null; if (profile?.logo_key) { profile.logoUrl = await getSignedUrl(s3,new GetObjectCommand({Bucket:imageBucket,Key:profile.logo_key}),{expiresIn:3600}); delete profile.logo_key; }
    return c.json(profile);
  });
  app.post("/api/school-profile/logo",async(c)=>{const context=await guard(c,"manage_settings");if(!context)return c.json({error:"Not allowed to upload a school logo."},403);const type=String(c.req.header("Content-Type")||"").split(";")[0].toLowerCase();if(!["image/jpeg","image/png","image/webp"].includes(type))return c.json({error:"Use a JPG, PNG, or WEBP image."},415);const bytes=Buffer.from(await c.req.arrayBuffer());if(!bytes.length||bytes.length>5*1024*1024)return c.json({error:"Logo must be smaller than 5 MB."},413);const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";if(!(type==="image/jpeg"&&jpeg)&&!(type==="image/png"&&png)&&!(type==="image/webp"&&webp))return c.json({error:"Image content does not match the selected file type."},415);const old=await pool.query("SELECT logo_key FROM school_profiles WHERE user_id=$1",[context.schoolId]);if(!old.rowCount)return c.json({error:"School profile not found."},404);const ext=type==="image/jpeg"?"jpg":type.slice(6),key="schools/"+context.schoolId+"/logo/"+randomUUID()+"."+ext;await s3.send(new PutObjectCommand({Bucket:imageBucket,Key:key,Body:bytes,ContentType:type}));try{await pool.query("UPDATE school_profiles SET logo_key=$2,updated_at=now() WHERE user_id=$1",[context.schoolId,key])}catch(error){await s3.send(new DeleteObjectCommand({Bucket:imageBucket,Key:key}));throw error}if(old.rows[0].logo_key){try{await s3.send(new DeleteObjectCommand({Bucket:imageBucket,Key:old.rows[0].logo_key}))}catch(error){console.error("Could not remove replaced school logo",error)}}const logoUrl=await getSignedUrl(s3,new GetObjectCommand({Bucket:imageBucket,Key:key}),{expiresIn:3600});return c.json({logoUrl},201)});
  app.post("/api/school-profile", async (c) => {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.schoolName !== "string" || !body.schoolName.trim()) return c.json({ error: "School name is required." }, 400);
    const userId = c.get("userId");
    const values = ["schoolType","email","phone","address","website","motto"].map((key) => typeof body[key] === "string" ? (body[key] as string).trim() : "");
    const result = await pool.query(
      `INSERT INTO school_profiles (user_id, school_name, school_type, contact_email, phone, address, website, motto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id) DO UPDATE SET school_name=EXCLUDED.school_name, school_type=EXCLUDED.school_type, contact_email=EXCLUDED.contact_email, phone=EXCLUDED.phone, address=EXCLUDED.address, website=EXCLUDED.website, motto=EXCLUDED.motto, updated_at=now()
       RETURNING school_name, school_type, contact_email, phone, address, website, motto`,
      [userId, body.schoolName.trim(), ...values],
    );
    await pool.query("INSERT INTO school_staff (user_id, school_owner_id, email, full_name, role, permissions) VALUES ($1,$1,$2,$3,'Admin',$4::jsonb) ON CONFLICT (user_id) DO NOTHING", [userId, c.get("userEmail"), c.get("userName"), JSON.stringify(allPermissions)]);
    return c.json(result.rows[0]);
  });
  app.put("/api/school-profile", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to edit school settings." }, 403);
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.schoolName !== "string" || !body.schoolName.trim()) return c.json({ error: "School name is required." }, 400);
    const term = typeof body.activeTerm === "string" ? body.activeTerm : "";
    if (term && !["Term 1", "Term 2", "Term 3"].includes(term)) return c.json({ error: "Choose Term 1, Term 2, or Term 3." }, 400);
    const academicYear = typeof body.academicYear === "string" ? body.academicYear.trim() : "";
    if (academicYear && !/^20\d{2}$/.test(academicYear)) return c.json({ error: "Academic year must be a four-digit year." }, 400);
    const fields = ["schoolName","schoolType","email","phone","address","website","motto","vision"];
    const vals = fields.map(key => typeof body[key] === "string" ? (body[key] as string).trim() : "");
    const dates = ["term1StartDate","term1EndDate","term2StartDate","term2EndDate","term3StartDate","term3EndDate"].map(key => typeof body[key] === "string" ? body[key] : "");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const old = await client.query("SELECT academic_year,active_term FROM school_profiles WHERE user_id=$1 FOR UPDATE", [context.schoolId]);
      const result = await client.query(`UPDATE school_profiles SET school_name=$2,school_type=$3,contact_email=$4,phone=$5,address=$6,website=$7,motto=$8,vision=$9,academic_year=$10,active_term=$11,term1_start_date=NULLIF($12,'')::date,term1_end_date=NULLIF($13,'')::date,term2_start_date=NULLIF($14,'')::date,term2_end_date=NULLIF($15,'')::date,term3_start_date=NULLIF($16,'')::date,term3_end_date=NULLIF($17,'')::date,updated_at=now() WHERE user_id=$1 RETURNING school_name,school_type,contact_email,phone,address,website,motto,vision,academic_year AS "academicYear",active_term AS "activeTerm",term1_start_date AS "term1StartDate",term1_end_date AS "term1EndDate",term2_start_date AS "term2StartDate",term2_end_date AS "term2EndDate",term3_start_date AS "term3StartDate",term3_end_date AS "term3EndDate"`, [context.schoolId,...vals,academicYear,term,...dates]);
      const previousTerm = old.rows[0] ? `${old.rows[0].active_term} ${old.rows[0].academic_year}`.trim() : "";
      const currentTerm = `${term} ${academicYear}`.trim(); let generatedFees = 0;
      if (term && academicYear && previousTerm !== currentTerm) {
        const number = Number(term.match(/[123]/)?.[0]); const termKey = `term${number}Fee`;
        const generated = await client.query(`INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment)
          SELECT s.school_owner_id,s.id,$2,'Fee obligation',COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric,CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)+COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee),c.name||' term fees'
          FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name
          WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees') RETURNING id`, [context.schoolId,currentTerm,termKey,number]);
        generatedFees = generated.rowCount ?? 0;
      }
      await client.query("COMMIT");
      return c.json({ ...result.rows[0], generatedFees });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  });
  app.get("/api/students", async (c) => {
    const context = await guard(c, "view_students"); if (!context) return c.json({ error: "Not allowed to view students." }, 403);
    const result = await pool.query("SELECT id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, phone, address, admitted_on AS admitted, status FROM school_students WHERE school_owner_id=$1 ORDER BY last_name,first_name", [context.schoolId]);
    return c.json(result.rows);
  });
  app.post("/api/students", async (c) => {
    const context = await guard(c, "edit_students"); if (!context) return c.json({ error: "Not allowed to edit students." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b || typeof b.first !== "string" || !b.first.trim() || typeof b.last !== "string" || !b.last.trim()) return c.json({ error: "First and last name are required." }, 400);
    const className = typeof b.class === "string" ? b.class.trim() : "";
    const stream = typeof b.stream === "string" ? b.stream.trim() : "";
    if (!["Male","Female"].includes(String(b.gender)) || !className || !stream) return c.json({ error: "Choose a gender, class, and stream." }, 400);
    const classRow = await pool.query("SELECT streams FROM school_classes WHERE school_owner_id=$1 AND name=$2", [context.schoolId,className]);
    if (!classRow.rowCount || !(classRow.rows[0].streams as string[]).includes(stream)) return c.json({ error: "Choose a stream configured for the selected class." }, 400);
    const adm = typeof b.adm === "string" && b.adm.trim() ? b.adm.trim() : `SY-${randomUUID().slice(0,8).toUpperCase()}`;
    const vals = [b.gender,b.dob,className,stream,b.guardian,b.phone,b.address,b.admitted,b.status].map((v) => typeof v === "string" ? v : "");
    try {
      const result = await pool.query(
        `INSERT INTO school_students (school_owner_id,admission_no,first_name,last_name,gender,date_of_birth,class_name,stream,guardian,phone,address,admitted_on,status)
         VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,$7,$8,$9,$10,$11,COALESCE(NULLIF($12,'')::date,CURRENT_DATE),COALESCE(NULLIF($13,''),'Active'))
         ON CONFLICT (school_owner_id,admission_no) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,gender=EXCLUDED.gender,date_of_birth=EXCLUDED.date_of_birth,class_name=EXCLUDED.class_name,stream=EXCLUDED.stream,guardian=EXCLUDED.guardian,phone=EXCLUDED.phone,address=EXCLUDED.address,status=EXCLUDED.status
         RETURNING id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, phone, address, admitted_on AS admitted, status`,
        [context.schoolId,adm,b.first.trim(),b.last.trim(),...vals],
      );
      const student=result.rows[0];
      if(student.status==="Active"){
        const profile=await pool.query("SELECT active_term,academic_year FROM school_profiles WHERE user_id=$1",[context.schoolId]);
        const match=String(profile.rows[0]?.active_term||"").match(/[123]/), year=String(profile.rows[0]?.academic_year||"");
        if(match&&year){const n=Number(match[0]),term=profile.rows[0].active_term+" "+year,key="term"+n+"Fee";await pool.query("INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment) SELECT s.school_owner_id,s.id,$3,'Fee obligation',COALESCE(NULLIF(cl.stream_fees->s.stream->>$4,'')::numeric,CASE $5::int WHEN 1 THEN cl.term1_fee WHEN 2 THEN cl.term2_fee ELSE cl.term3_fee END)+COALESCE(NULLIF(cl.stream_fees->s.stream->>'extraFee','')::numeric,cl.extra_fee),cl.name||' term fees' FROM school_students s JOIN school_classes cl ON cl.school_owner_id=s.school_owner_id AND cl.name=s.class_name WHERE s.id=$1 AND s.school_owner_id=$2 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.student_id=s.id AND f.school_owner_id=s.school_owner_id AND f.term=$3 AND f.entry_type='Fee obligation' AND f.comment=cl.name||' term fees')",[student.id,context.schoolId,term,key,n])}
      }
      return c.json(student, 201);
    } catch (error) { return c.json({ error: "Could not save the student. Check the admission number and dates." }, 400); }
  });
  app.get("/api/students/:id", async (c) => {
    const context = await guard(c, "view_students"); if (!context) return c.json({ error: "Not allowed to view students." }, 403);
    const student = await pool.query("SELECT id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, phone, address, admitted_on AS admitted, status, photo_key AS \"photoKey\" FROM school_students WHERE id=$1 AND school_owner_id=$2", [c.req.param("id"),context.schoolId]);
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const row=student.rows[0]; const photoUrl=row.photoKey?await getSignedUrl(s3,new GetObjectCommand({Bucket:imageBucket,Key:row.photoKey}),{expiresIn:3600}):"";
    const fees = await pool.query("SELECT id, entry_date AS date, term, entry_type AS entry, debit, credit, method, reference, comment FROM school_fee_entries WHERE student_id=$1 AND school_owner_id=$2 ORDER BY entry_date DESC,created_at DESC", [c.req.param("id"),context.schoolId]);
    return c.json({student:{...row,photoUrl},fees:fees.rows});
  });
  app.post("/api/students/:id/photo",async(c)=>{
    const context=await guard(c,"edit_students");if(!context)return c.json({error:"Not allowed to upload student photos."},403);
    const student=await pool.query("SELECT photo_key FROM school_students WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),context.schoolId]);if(!student.rowCount)return c.json({error:"Student not found."},404);
    const contentType=String(c.req.header("Content-Type")||"").split(";")[0].toLowerCase();const types=["image/jpeg","image/png","image/webp"];
    if(!types.includes(contentType))return c.json({error:"Use a JPG, PNG, or WEBP image."},415);
    const bytes=new Uint8Array(await c.req.arrayBuffer());if(!bytes.length||bytes.byteLength>10*1024*1024)return c.json({error:"Choose an image no larger than 10 MB."},413);
    const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
    if(!(contentType==="image/jpeg"&&jpeg)&&!(contentType==="image/png"&&png)&&!(contentType==="image/webp"&&webp))return c.json({error:"The file contents do not match a JPG, PNG, or WEBP image."},415);
    const ext=contentType==="image/jpeg"?"jpg":contentType.slice(6);const key=`students/${context.schoolId}/${c.req.param("id")}/${randomUUID()}.${ext}`;
    await s3.send(new PutObjectCommand({Bucket:imageBucket,Key:key,Body:bytes,ContentType:contentType,CacheControl:"private, max-age=300"}));
    try{await pool.query("UPDATE school_students SET photo_key=$3 WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),context.schoolId,key])}catch(error){await s3.send(new DeleteObjectCommand({Bucket:imageBucket,Key:key}));throw error}
    const previous=student.rows[0].photo_key;if(previous){try{await s3.send(new DeleteObjectCommand({Bucket:imageBucket,Key:previous}))}catch(error){console.error("Could not remove replaced student photo",error)}}
    const url=await getSignedUrl(s3,new GetObjectCommand({Bucket:imageBucket,Key:key}),{expiresIn:3600});return c.json({photoUrl:url},201);
  });  app.post("/api/students/:id/fees", async (c) => {
    const context = await guard(c, "edit_fees"); if (!context) return c.json({ error: "Not allowed to record fees." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const allowed = ["Payment", "Debt added", "Credit added", "Balance set"];
    const entry = String(b?.entry || ""); const amount = Number(b?.amount);
    if (!b || !allowed.includes(entry) || !Number.isFinite(amount) || amount < 0 || (entry !== "Balance set" && amount <= 0)) return c.json({ error: "Choose a valid fee entry and amount." }, 400);
    const method = typeof b.method === "string" ? b.method : "";
    if (entry === "Payment" && !["M-Pesa", "Cash", "Bank", "Card", "Other"].includes(method)) return c.json({ error: "Choose a valid payment method." }, 400);
    const comment = typeof b.comment === "string" ? b.comment.trim() : "";
    if (entry !== "Payment" && !comment) return c.json({ error: "A reason is required for fee adjustments." }, 400);
    const entryDate = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
    const requestKey = typeof b.requestId === "string" && b.requestId.length <= 100 ? b.requestId : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const student = await client.query("SELECT id FROM school_students WHERE id=$1 AND school_owner_id=$2 FOR UPDATE", [c.req.param("id"), context.schoolId]);
      if (!student.rowCount) { await client.query("ROLLBACK"); return c.json({ error: "Student not found." }, 404); }
      if (requestKey) {
        const prior = await client.query("SELECT id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment FROM school_fee_entries WHERE school_owner_id=$1 AND request_key=$2", [context.schoolId, requestKey]);
        if (prior.rowCount) { await client.query("COMMIT"); return c.json(prior.rows[0]); }
      }
      const current = await client.query("SELECT COALESCE(sum(debit-credit),0) AS balance FROM school_fee_entries WHERE school_owner_id=$1 AND student_id=$2", [context.schoolId, c.req.param("id")]);
      const previousBalance = Number(current.rows[0].balance);
      let debit = entry === "Debt added" ? amount : 0; let credit = entry === "Credit added" || entry === "Payment" ? amount : 0;
      let details = comment;
      if (entry === "Balance set") {
        debit = Math.max(0, amount - previousBalance); credit = Math.max(0, previousBalance - amount);
        details = `Previous balance: KES ${previousBalance.toFixed(2)}; new balance: KES ${amount.toFixed(2)}. Reason: ${comment}`;
      }
      const result = await client.query("INSERT INTO school_fee_entries(school_owner_id,student_id,entry_date,term,entry_type,debit,credit,method,reference,comment,request_key) VALUES($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment", [context.schoolId,c.req.param("id"),entryDate,typeof b.term === "string" ? b.term.trim() : "",entry,debit,credit,method,typeof b.reference === "string" ? b.reference.trim() : "",details,requestKey]);
      await client.query("COMMIT");
      return c.json({ ...result.rows[0], balance: previousBalance + debit - credit }, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      if (requestKey && (error as { code?: string }).code === "23505") {
        const prior = await pool.query("SELECT id,entry_date AS date,term,entry_type AS entry,debit,credit,method,reference,comment FROM school_fee_entries WHERE school_owner_id=$1 AND request_key=$2", [context.schoolId, requestKey]);
        if (prior.rowCount) return c.json(prior.rows[0]);
      }
      return c.json({ error: "Could not record the fee entry." }, 400);
    } finally { client.release(); }
  });

  app.delete("/api/students/:id", async (c) => {
    const context = await guard(c, "edit_students"); if (!context) return c.json({ error: "Not allowed to edit students." }, 403);
    const found=await pool.query("SELECT photo_key FROM school_students WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),context.schoolId]); if(!found.rowCount)return c.json({error:"Student not found."},404); await pool.query("DELETE FROM school_students WHERE id=$1 AND school_owner_id=$2", [c.req.param("id"),context.schoolId]); if(found.rows[0].photo_key)await s3.send(new DeleteObjectCommand({Bucket:imageBucket,Key:found.rows[0].photo_key}));
    return c.json({ ok: true });
  });
  app.get("/api/fees", async (c) => {
    const context = await guard(c, "view_fees"); if (!context) return c.json({ error: "Not allowed to view fees." }, 403);
    const result = await pool.query(`SELECT s.id, s.admission_no AS adm, s.first_name AS first, s.last_name AS last, s.class_name AS class,
      COALESCE(sum(f.debit),0) AS billed, COALESCE(sum(f.credit),0) AS paid, COALESCE(sum(f.debit-f.credit),0) AS balance
      FROM school_students s LEFT JOIN school_fee_entries f ON f.student_id=s.id AND f.school_owner_id=s.school_owner_id
      WHERE s.school_owner_id=$1 GROUP BY s.id ORDER BY s.last_name,s.first_name`, [context.schoolId]);
    return c.json(result.rows);
  });
  app.get("/api/reports/students",async(c)=>{const x=await guard(c,"view_students");if(!x)return c.json({error:"Not allowed to view student reports."},403);const className=String(c.req.query("class")||"");const stream=String(c.req.query("stream")||"");const r=await pool.query(`SELECT admission_no AS adm,first_name AS first,last_name AS last,gender,class_name AS class,stream,guardian,phone,status FROM school_students WHERE school_owner_id=$1 AND ($2='' OR class_name=$2) AND ($3='' OR stream=$3) ORDER BY class_name,stream,last_name,first_name`,[x.schoolId,className,stream]);return c.json(r.rows)});
  app.get("/api/reports/fees",async(c)=>{const x=await guard(c,"view_fees");if(!x)return c.json({error:"Not allowed to view fee reports."},403);const term=String(c.req.query("term")||"");const className=String(c.req.query("class")||"");const stream=String(c.req.query("stream")||"");const r=await pool.query(`SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,COALESCE(sum(f.debit),0) AS billed,COALESCE(sum(f.credit),0) AS paid,COALESCE(sum(f.debit-f.credit),0) AS balance FROM school_students s LEFT JOIN school_fee_entries f ON f.student_id=s.id AND f.school_owner_id=s.school_owner_id AND ($2='' OR f.term=$2) WHERE s.school_owner_id=$1 AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) GROUP BY s.id ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,[x.schoolId,term,className,stream]);return c.json(r.rows)});
  app.get("/api/reports/attendance",async(c)=>{const x=await guard(c,"view_attendance");if(!x)return c.json({error:"Not allowed to view attendance reports."},403);const date=String(c.req.query("date")||new Date().toISOString().slice(0,10));const className=String(c.req.query("class")||"");const stream=String(c.req.query("stream")||"");const r=await pool.query(`SELECT s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,COALESCE(a.status,'Not marked') AS status FROM school_students s LEFT JOIN school_attendance a ON a.student_id=s.id AND a.attendance_date=$2 WHERE s.school_owner_id=$1 AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,[x.schoolId,date,className,stream]);return c.json(r.rows)});  app.get("/api/attendance", async (c) => {
    const context=await guard(c,"view_attendance"); if(!context)return c.json({error:"Not allowed to view attendance."},403);
    const date=String(c.req.query("date")||new Date().toISOString().slice(0,10));
    const className=String(c.req.query("class")||""); const stream=String(c.req.query("stream")||"");
    const result=await pool.query(`SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,a.status
      FROM school_students s LEFT JOIN school_attendance a ON a.student_id=s.id AND a.attendance_date=$2
      WHERE s.school_owner_id=$1 AND s.status='Active' AND ($3='' OR s.class_name=$3) AND ($4='' OR s.stream=$4) ORDER BY s.class_name,s.stream,s.last_name,s.first_name`,[context.schoolId,date,className,stream]);    return c.json(result.rows);
  });
  app.post("/api/attendance",async(c)=>{
    const context=await guard(c,"edit_attendance");if(!context)return c.json({error:"Not allowed to edit attendance."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    if(typeof b?.studentId!=="string"||!['Present','Absent','Late','Excused'].includes(String(b.status)))return c.json({error:"Choose a student and valid attendance status."},400);
    const student=await pool.query("SELECT id FROM school_students WHERE id=$1 AND school_owner_id=$2",[b.studentId,context.schoolId]);if(!student.rowCount)return c.json({error:"Student not found."},404);
    const date=typeof b.date==="string"?b.date:new Date().toISOString().slice(0,10);
    const r=await pool.query("INSERT INTO school_attendance (school_owner_id,student_id,attendance_date,status,recorded_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by RETURNING id,status",[context.schoolId,b.studentId,date,b.status,c.get("userId")]);return c.json(r.rows[0]);
  });
  app.get("/api/staff", async (c) => {
    const context = await guard(c, "manage_staff"); if (!context) return c.json({ error: "Only school administrators can manage staff." }, 403);
    const result = await pool.query("SELECT user_id AS id,email,full_name AS name,role,permissions,active FROM school_staff WHERE school_owner_id=$1 ORDER BY full_name", [context.schoolId]);
    return c.json({ staff: result.rows, permissions: allPermissions });
  });
  app.post("/api/staff/invitations", async (c) => {
    const context=await guard(c,"manage_staff");
    if(!context)return c.json({error:"Only school administrators can invite staff."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    if(!b||typeof b.email!=="string"||!b.email.includes("@")||typeof b.name!=="string"||!b.name.trim())return c.json({error:"A name and valid email are required."},400);
    const email=b.email.trim().toLowerCase(), name=b.name.trim();
    const role=typeof b.role==="string"&&b.role in rolePermissions&&b.role!=="Admin"?b.role:"Teacher";
    const requested=Array.isArray(b.permissions)?b.permissions.filter((p):p is Permission=>allPermissions.includes(p as Permission)):rolePermissions[role];
    const shouldSendEmail=b.sendEmail===true;
    const configuredUrl=String(process.env.SHULE_YETU_APP_URL||c.req.header("Origin")||"");
    let appOrigin="";
    try{const parsed=new URL(configuredUrl);if(parsed.protocol==="https:"||parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1")appOrigin=parsed.origin}catch{}
    if(!appOrigin)return c.json({error:"Could not determine the school website address for the invitation link."},400);
    const inviteCode=randomUUID();
    try{
      const result=await pool.query("INSERT INTO school_invites(school_owner_id,invite_code,email,full_name,role,permissions) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(school_owner_id,email) DO UPDATE SET invite_code=EXCLUDED.invite_code,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,expires_at=now()+interval '7 days' RETURNING invite_code,email,full_name,role,expires_at",[context.schoolId,inviteCode,email,name,role,JSON.stringify(requested)]);
      const invite=result.rows[0], inviteUrl=new URL("/register",appOrigin);
      inviteUrl.searchParams.set("invite",invite.invite_code);
      let emailSent=false,emailError="";
      if(shouldSendEmail){
        const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
        if(!apiKey||!from)emailError="Email sending is not configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the Neon Function environment.";
        else{
          const link=inviteUrl.toString();
          try{
            const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[String(invite.email)],subject:"Invitation to join "+String(context.name)+" on Shule Yetu",text:"Hello "+name+",\n\n"+String(context.name)+" has invited you to join its school team on Shule Yetu. Open this link to create your account and join: "+link+"\n\nThis invitation expires in 7 days.",html:"<p>Hello "+escapeHtml(name)+"</p><p>"+escapeHtml(String(context.name))+" has invited you to join its school team on Shule Yetu.</p><p><a href=\""+escapeHtml(link)+"\">Accept the invitation</a></p><p>This invitation expires in 7 days.</p>"})});
            if(sent.ok)emailSent=true;else{console.error("Resend invitation email failed with status",sent.status);emailError="The invitation was created, but Resend could not send the email. Copy and send the invitation link instead."}
          }catch(error){console.error("Resend invitation email request failed",error);emailError="The invitation was created, but the email service could not be reached. Copy and send the invitation link instead."}
        }
      }
      return c.json({...invite,inviteUrl:inviteUrl.toString(),emailSent,emailError},201);
    }catch{return c.json({error:"That email is already registered with this school."},409)}
  });  app.patch("/api/staff/:id", async (c) => {
    const context = await guard(c, "manage_staff"); if (!context) return c.json({ error: "Only school administrators can update staff." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const permissions = Array.isArray(b?.permissions) ? b.permissions.filter((p): p is Permission => allPermissions.includes(p as Permission)) : [];
    const role = typeof b?.role === "string" && b.role in rolePermissions ? b.role : "Teacher";
    const result = await pool.query("UPDATE school_staff SET role=$3,permissions=$4::jsonb,active=COALESCE($5::boolean,active) WHERE user_id=$1 AND school_owner_id=$2 AND role<>'Admin' RETURNING user_id AS id,email,full_name AS name,role,permissions,active", [c.req.param("id"),context.schoolId,role,JSON.stringify(permissions),typeof b?.active === "boolean" ? b.active : null]);
    if (!result.rowCount) return c.json({ error: "Staff member not found or protected." },404);
    return c.json(result.rows[0]);
  });
  app.get("/api/staff/:id/assignments", async (c) => {
    const context = await guard(c,"manage_staff"); if (!context) return c.json({error:"Only administrators can view assignments."},403);
    const result=await pool.query(`SELECT a.id,a.class_id AS "classId",c.name AS "className",a.stream,a.subjects FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id AND c.school_owner_id=a.school_owner_id WHERE a.school_owner_id=$1 AND a.user_id=$2 ORDER BY c.name,a.stream`,[context.schoolId,c.req.param("id")]);
    return c.json(result.rows);
  });
  app.put("/api/staff/:id/assignments", async (c) => {
    const context=await guard(c,"manage_staff"); if(!context)return c.json({error:"Only administrators can edit assignments."},403);
    const body=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    const rows=Array.isArray(body?.assignments)?body.assignments as Record<string,unknown>[]:null;
    if(!rows)return c.json({error:"Assignments must be a list."},400);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const member=await client.query("SELECT user_id FROM school_staff WHERE user_id=$1 AND school_owner_id=$2 AND role='Teacher' FOR UPDATE",[c.req.param("id"),context.schoolId]);
      if(!member.rowCount){await client.query("ROLLBACK");return c.json({error:"Teacher not found."},404)}
      const clean:Array<{classId:string;stream:string;subjects:string[]}>=[];
      for(const row of rows){
        const classId=typeof row.classId==="string"?row.classId:"";const stream=typeof row.stream==="string"?row.stream.trim():"";
        const cls=await client.query("SELECT name,streams,subjects FROM school_classes WHERE id=$1 AND school_owner_id=$2",[classId,context.schoolId]);
        if(!cls.rowCount||(cls.rows[0].streams as string[]).indexOf(stream)<0){await client.query("ROLLBACK");return c.json({error:"Every assignment must use a configured class and one of its streams."},400)}
        const valid=cls.rows[0].subjects as string[];const subjects=Array.isArray(row.subjects)?row.subjects.filter((x):x is string=>typeof x==="string"):[];
        if(!subjects.length||subjects.some(subject=>!valid.includes(subject))){await client.query("ROLLBACK");return c.json({error:`Choose subjects configured for ${cls.rows[0].name}.`},400)}
        if(clean.some(x=>x.classId===classId&&x.stream===stream)){await client.query("ROLLBACK");return c.json({error:"Remove duplicate class and stream assignment rows."},400)}
        clean.push({classId,stream,subjects});
      }
      await client.query("DELETE FROM school_teacher_assignments WHERE school_owner_id=$1 AND user_id=$2",[context.schoolId,c.req.param("id")]);
      for(const row of clean)await client.query("INSERT INTO school_teacher_assignments(school_owner_id,user_id,class_id,stream,subjects) VALUES($1,$2,$3,$4,$5::jsonb)",[context.schoolId,c.req.param("id"),row.classId,row.stream,JSON.stringify(row.subjects)]);
      await client.query("COMMIT");return c.json({assignments:clean.length});
    }catch(error){await client.query("ROLLBACK");return c.json({error:"Could not save teacher assignments."},400)}finally{client.release()}
  });  app.post("/api/staff/accept-invite", async (c) => {
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    if(typeof b?.code!=="string")return c.json({error:"Invitation code required."},400);
    const email=String(c.get("userEmail")||"").trim().toLowerCase();
    if(!email)return c.json({error:"Sign in with the email address that received the invitation."},400);
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const found=await client.query("SELECT school_owner_id,email,full_name,role,permissions FROM school_invites WHERE invite_code=$1 AND lower(trim(email))=$2 AND expires_at>now() FOR UPDATE",[b.code,email]);
      if(!found.rowCount){await client.query("ROLLBACK");return c.json({error:"Invitation is invalid, expired, or for another email. Sign up with the invited email address."},400)}
      const i=found.rows[0];
      await client.query("INSERT INTO school_staff(user_id,school_owner_id,email,full_name,role,permissions) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(user_id) DO UPDATE SET school_owner_id=EXCLUDED.school_owner_id,email=EXCLUDED.email,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,active=true",[c.get("userId"),i.school_owner_id,i.email,i.full_name,i.role,JSON.stringify(i.permissions)]);
      await client.query("DELETE FROM school_invites WHERE invite_code=$1",[b.code]);
      await client.query("COMMIT");
      return c.json({ok:true,schoolOwnerId:i.school_owner_id});
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  });  app.get("/api/classes", async (c) => {
    const x = await contextFor(c);
    if (!x || (!x.permissions.includes("view_classes") && !x.permissions.includes("view_students") && !x.permissions.includes("edit_students") && x.role !== "Admin")) return c.json({ error: "Not allowed to view classes." }, 403);
    return c.json((await pool.query(`SELECT id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees" FROM school_classes WHERE school_owner_id=$1 ORDER BY name`, [x.schoolId])).rows);
  });
  app.post("/api/classes", async (c) => {
    const x = await guard(c, "edit_classes"); if (!x) return c.json({ error: "Not allowed to edit classes." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (typeof b?.name !== "string" || !b.name.trim()) return c.json({ error: "Class name is required." }, 400);
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((a): a is string => typeof a === "string").map(a => a.trim()).filter(Boolean) : [];
    const streams = strings(b.streams), subjects = strings(b.subjects);
    const fee = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
    const streamFees = typeof b.streamFees === "object" && b.streamFees !== null ? b.streamFees as Record<string, unknown> : {};
    for (const key of Object.keys(streamFees)) if (!streams.includes(key)) return c.json({ error: `Fee override stream '${key}' is not configured for this class.` }, 400);
    const optionalFee = (v: unknown): number | null => v === null || v === undefined || v === "" ? null : (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
    const cleanOverrides: Record<string, { term1Fee:number|null; term2Fee:number|null; term3Fee:number|null; extraFee:number|null }> = {};
    for (const stream of streams) { const value = typeof streamFees[stream] === "object" && streamFees[stream] !== null ? streamFees[stream] as Record<string, unknown> : {}; cleanOverrides[stream] = { term1Fee:optionalFee(value.term1Fee), term2Fee:optionalFee(value.term2Fee), term3Fee:optionalFee(value.term3Fee), extraFee:optionalFee(value.extraFee) }; }
    const t1=fee(b.term1Fee), t2=fee(b.term2Fee), t3=fee(b.term3Fee), extra=fee(b.extraFee);
    const duplicate=await pool.query("SELECT 1 FROM school_classes WHERE school_owner_id=$1 AND lower(name)=lower($2)",[x.schoolId,b.name.trim()]); if(duplicate.rowCount)return c.json({error:"This class already exists. Open it above to edit its streams or fees."},409);
    const result = await pool.query(`INSERT INTO school_classes(school_owner_id,name,streams,subjects,term_fee,term1_fee,term2_fee,term3_fee,extra_fee,stream_fees) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(school_owner_id,name) DO NOTHING RETURNING id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees"`, [x.schoolId,b.name.trim(),JSON.stringify(streams),JSON.stringify(subjects),t1,t2,t3,extra,JSON.stringify(cleanOverrides)]);
    if (!result.rowCount) return c.json({error:"This class already exists. Open it above to edit its streams or fees."},409);
    return c.json(result.rows[0], 201);
  });  app.post("/api/classes/generate-fees",async(c)=>{
    const x=await guard(c,"edit_fees"); if(!x)return c.json({error:"Not allowed to generate fee obligations."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    const term=typeof b?.term==="string"?b.term.trim():""; const match=term.match(/\bterm\s*([123])\b/i);
    if(!match)return c.json({error:"Enter a term such as Term 1 2027."},400);
    const termNumber=Number(match[1]); const termKey=`term${termNumber}Fee`;
    const r=await pool.query(`INSERT INTO school_fee_entries(school_owner_id,student_id,term,entry_type,debit,comment)
      SELECT s.school_owner_id,s.id,$2,'Fee obligation',
        COALESCE(NULLIF(c.stream_fees->s.stream->>$3,'')::numeric, CASE $4::int WHEN 1 THEN c.term1_fee WHEN 2 THEN c.term2_fee ELSE c.term3_fee END)
        + COALESCE(NULLIF(c.stream_fees->s.stream->>'extraFee','')::numeric,c.extra_fee), c.name||' term fees'
      FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name
      WHERE s.school_owner_id=$1 AND s.status='Active' AND NOT EXISTS(SELECT 1 FROM school_fee_entries f WHERE f.school_owner_id=s.school_owner_id AND f.student_id=s.id AND f.term=$2 AND f.entry_type='Fee obligation' AND f.comment=c.name||' term fees')
      RETURNING id`,[x.schoolId,term,termKey,termNumber]);
    return c.json({created:r.rowCount??0,term});
  });app.put("/api/classes/:id",async(c)=>{
    const x=await guard(c,"edit_classes");if(!x)return c.json({error:"Not allowed."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    const list=(v:unknown)=>Array.isArray(v)?v.filter((a):a is string=>typeof a==="string").map(a=>a.trim()).filter(Boolean):[];
    const streams=list(b?.streams),subjects=list(b?.subjects);
    const existing=await pool.query("SELECT name,streams FROM school_classes WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);
    if(!existing.rowCount)return c.json({error:"Class not found."},404);
    const removed=(existing.rows[0].streams as string[]).filter(s=>!streams.includes(s));
    if(removed.length){const assigned=await pool.query("SELECT 1 FROM school_students WHERE school_owner_id=$1 AND class_name=$2 AND stream=ANY($3::text[]) LIMIT 1",[x.schoolId,existing.rows[0].name,removed]);if(assigned.rowCount)return c.json({error:"A stream with assigned students cannot be removed."},409)}
    const fee=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0?v:0;
    const optional=(v:unknown)=>v===null||v===undefined||v===""?null:fee(v);
    const overrides=typeof b?.streamFees==="object"&&b.streamFees!==null?b.streamFees as Record<string,Record<string,unknown>>:{};
    const clean:Record<string,unknown>={};for(const stream of streams){const v=overrides[stream]||{};clean[stream]={term1Fee:optional(v.term1Fee),term2Fee:optional(v.term2Fee),term3Fee:optional(v.term3Fee),extraFee:optional(v.extraFee)}}
    const r=await pool.query(`UPDATE school_classes SET streams=$3::jsonb,subjects=$4::jsonb,term_fee=$5,term1_fee=$5,term2_fee=$6,term3_fee=$7,extra_fee=$8,stream_fees=$9::jsonb WHERE id=$1 AND school_owner_id=$2 RETURNING id,name,streams,subjects,term1_fee AS "term1Fee",term2_fee AS "term2Fee",term3_fee AS "term3Fee",extra_fee AS "extraFee",stream_fees AS "streamFees"`,[c.req.param("id"),x.schoolId,JSON.stringify(streams),JSON.stringify(subjects),fee(b?.term1Fee),fee(b?.term2Fee),fee(b?.term3Fee),fee(b?.extraFee),JSON.stringify(clean)]);return c.json(r.rows[0]);
  });
  app.delete("/api/classes/:id",async(c)=>{const x=await guard(c,"edit_classes");if(!x)return c.json({error:"Not allowed."},403);const r=await pool.query("DELETE FROM school_classes c WHERE c.id=$1 AND c.school_owner_id=$2 AND NOT EXISTS(SELECT 1 FROM school_students s WHERE s.school_owner_id=c.school_owner_id AND s.class_name=c.name) RETURNING c.id",[c.req.param("id"),x.schoolId]);if(!r.rowCount)return c.json({error:"Class not found or students are still assigned to it."},409);return c.json({ok:true})});app.get("/api/announcements",async(c)=>{const x=await guard(c,"view_announcements");if(!x)return c.json({error:"Not allowed to view announcements."},403);await pool.query("DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",[x.schoolId]);return c.json((await pool.query("SELECT id,title,body,author_name AS \"authorName\",created_at AS \"createdAt\",expires_at AS \"expiresAt\" FROM school_announcements WHERE school_owner_id=$1 AND expires_at>now() ORDER BY created_at DESC",[x.schoolId])).rows)});
  app.post("/api/announcements",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"You do not have permission to create announcements."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;if(typeof b?.title!=="string"||!b.title.trim()||typeof b.body!=="string"||!b.body.trim())return c.json({error:"Title and announcement are required."},400);const expiry=new Date(String(b.expiresAt||""));if(!Number.isFinite(expiry.getTime())||expiry<=new Date())return c.json({error:"Choose a future expiry date."},400);const r=await pool.query("INSERT INTO school_announcements (school_owner_id,title,body,author_user_id,author_name,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,title,body,author_name AS \"authorName\",created_at AS \"createdAt\",expires_at AS \"expiresAt\"",[x.schoolId,b.title.trim(),b.body.trim(),c.get("userId"),x.name,expiry.toISOString()]);return c.json(r.rows[0],201)});
  app.delete("/api/announcements/:id",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"You do not have permission to delete announcements."},403);await pool.query("DELETE FROM school_announcements WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);return c.json({ok:true})});

  app.get("/api/exams",async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed to view exams."},403);const r=await pool.query(`SELECT e.id,e.name,e.class_name AS "className",e.stream,e.term,e.academic_year AS "academicYear",e.starts_on AS "startsOn",e.ends_on AS "endsOn",count(m.id) FILTER(WHERE m.status='Pending') AS pending FROM school_exams e LEFT JOIN school_marks m ON m.exam_id=e.id WHERE e.school_owner_id=$1 AND ($2='Admin' OR EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=e.school_owner_id AND a.user_id=$3 AND c.name=e.class_name AND (a.stream=e.stream OR e.stream='*'))) GROUP BY e.id ORDER BY e.created_at DESC`,[x.schoolId,x.role,c.get("userId")]);return c.json(r.rows)});
  app.post("/api/exams",async(c)=>{const x=await guard(c,"edit_exams");if(!x)return c.json({error:"Not allowed to create exams."},403);if(x.role!=="Admin")return c.json({error:"Only administrators can create exams."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;if(typeof b?.name!=="string"||typeof b.className!=="string"||typeof b.startsOn!=="string"||typeof b.endsOn!=="string"||b.endsOn<b.startsOn||typeof b.academicYear!=="string"||!/^20\d{2}$/.test(b.academicYear))return c.json({error:"Exam name, class, and valid dates are required."},400);const stream=String(b.stream||"");const cls=await pool.query("SELECT subjects,streams FROM school_classes WHERE school_owner_id=$1 AND name=$2",[x.schoolId,b.className]);if(!cls.rowCount||(stream!=="*"&&!(cls.rows[0].streams as string[]).includes(stream)))return c.json({error:"Choose a class and stream configured in this school."},400);const result=await pool.query("INSERT INTO school_exams(school_owner_id,name,class_name,stream,term,academic_year,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[x.schoolId,b.name.trim(),b.className,stream,String(b.term||""),b.academicYear,b.startsOn,b.endsOn]);const id=result.rows[0].id;await pool.query(`INSERT INTO school_marks(school_owner_id,exam_id,student_id,subject,score,entered_by) SELECT $1,$2,s.id,sub.value,0,$3 FROM school_students s CROSS JOIN LATERAL jsonb_array_elements_text($4::jsonb) AS sub(value) WHERE s.school_owner_id=$1 AND s.class_name=$5 AND ($6='*' OR s.stream=$6) AND s.status='Active' ON CONFLICT(exam_id,student_id,subject) DO NOTHING`,[x.schoolId,id,c.get("userId"),JSON.stringify(cls.rows[0].subjects||[]),b.className,stream]);return c.json({id},201)});
  app.get("/api/exams/:id/marks",async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed."},403);const r=await pool.query(`SELECT m.id,s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id AND s.school_owner_id=m.school_owner_id JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.exam_id=$1 AND m.school_owner_id=$2 AND ($3='Admin' OR EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$4 AND c.name=e.class_name AND a.stream=s.stream AND a.subjects ? m.subject)) ORDER BY s.last_name,s.first_name,m.subject`,[c.req.param("id"),x.schoolId,x.role,c.get("userId")]);return c.json(r.rows)});
  app.patch("/api/marks/:id",async(c)=>{const x=await guard(c,"edit_exams");if(!x)return c.json({error:"Not allowed to edit marks."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;const score=Number(b?.score);const status=b?.status;if(!Number.isFinite(score)||score<0||score>100||!['Pending','Approved','Denied'].includes(String(status)))return c.json({error:"Score must be between 0 and 100 and status must be valid."},400);if(x.role!=="Admin"&&status!=="Pending")return c.json({error:"Only administrators can approve or deny marks."},403);const r=await pool.query(`UPDATE school_marks m SET score=$3,status=$4 FROM school_exams e WHERE m.id=$1 AND m.school_owner_id=$2 AND e.id=m.exam_id AND e.school_owner_id=m.school_owner_id AND ($5='Admin' OR (m.status='Pending' AND $4='Pending' AND EXISTS(SELECT 1 FROM school_teacher_assignments a JOIN school_classes c ON c.id=a.class_id WHERE a.school_owner_id=m.school_owner_id AND a.user_id=$6 AND c.name=e.class_name AND (a.stream=e.stream OR (e.stream='*' AND EXISTS(SELECT 1 FROM school_students assigned WHERE assigned.id=m.student_id AND assigned.stream=a.stream))) AND a.subjects ? m.subject))) RETURNING m.id`,[c.req.param("id"),x.schoolId,score,status,x.role,c.get("userId")]);if(!r.rowCount)return c.json({error:"Mark not found or outside your assignment."},404);return c.json((await pool.query("SELECT m.id,s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id WHERE m.id=$1 AND m.school_owner_id=$2",[c.req.param("id"),x.schoolId])).rows[0])});  app.post("/api/exams/:id/approve-pending",async(c)=>{const x=await guard(c,"edit_exams");if(!x)return c.json({error:"Not allowed."},403);if(x.role!=="Admin")return c.json({error:"Only administrators can approve marks."},403);const client=await pool.connect();try{await client.query("BEGIN");const exam=await client.query("SELECT id FROM school_exams WHERE id=$1 AND school_owner_id=$2 FOR UPDATE",[c.req.param("id"),x.schoolId]);if(!exam.rowCount){await client.query("ROLLBACK");return c.json({error:"Exam not found."},404)}const r=await client.query("UPDATE school_marks SET status='Approved' WHERE exam_id=$1 AND school_owner_id=$2 AND status='Pending' RETURNING id",[c.req.param("id"),x.schoolId]);await client.query("COMMIT");return c.json({approved:r.rowCount||0})}catch{await client.query("ROLLBACK");return c.json({error:"Could not approve pending marks."},400)}finally{client.release()}});
  app.get("/api/exams/:id/report",async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed."},403);if(x.role!=="Admin")return c.json({error:"Only administrators can view ranked reports."},403);const meta=await pool.query(`SELECT e.name,e.class_name AS "className",e.stream,e.term,e.academic_year AS "academicYear",p.school_name AS "schoolName",cl.subjects FROM school_exams e JOIN school_profiles p ON p.user_id=e.school_owner_id JOIN school_classes cl ON cl.school_owner_id=e.school_owner_id AND cl.name=e.class_name WHERE e.id=$1 AND e.school_owner_id=$2`,[c.req.param("id"),x.schoolId]);if(!meta.rowCount)return c.json({error:"Exam not found."},404);const students=await pool.query(`WITH totals AS (SELECT s.id,s.admission_no AS adm,s.first_name||' '||s.last_name AS name,s.stream,COALESCE(sum(m.score) FILTER(WHERE m.status='Approved'),0) AS total,COALESCE(jsonb_object_agg(m.subject,m.score) FILTER(WHERE m.status='Approved'), '{}'::jsonb) AS marks FROM school_exams e JOIN school_students s ON s.school_owner_id=e.school_owner_id AND s.class_name=e.class_name AND (e.stream='*' OR s.stream=e.stream) AND s.status='Active' LEFT JOIN school_marks m ON m.exam_id=e.id AND m.student_id=s.id AND m.status='Approved' WHERE e.id=$1 AND e.school_owner_id=$2 GROUP BY s.id) SELECT *,DENSE_RANK() OVER(ORDER BY total DESC) AS position FROM totals ORDER BY position,name`,[c.req.param("id"),x.schoolId]);return c.json({...meta.rows[0],subjects:meta.rows[0].subjects||[],students:students.rows})});  app.get("/api/students/:id/report-card",async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed to view report cards."},403);if(x.role!=="Admin")return c.json({error:"Only administrators can print report cards."},403);const student=await pool.query(`SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS "class",s.stream,p.school_name AS "schoolName" FROM school_students s JOIN school_profiles p ON p.user_id=s.school_owner_id WHERE s.id=$1 AND s.school_owner_id=$2`,[c.req.param("id"),x.schoolId]);if(!student.rowCount)return c.json({error:"Student not found."},404);const rows=await pool.query(`SELECT e.id,e.name AS exam,e.term,e.academic_year AS "academicYear",m.subject,m.score FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.student_id=$1 AND m.school_owner_id=$2 AND m.status='Approved' ORDER BY e.academic_year,e.created_at,m.subject`,[c.req.param("id"),x.schoolId]);const exams=new Map();for(const r of rows.rows){if(!exams.has(r.id))exams.set(r.id,{id:r.id,exam:r.exam,term:r.term,academicYear:r.academicYear,marks:[],total:0});const e=exams.get(r.id);e.marks.push({subject:r.subject,score:Number(r.score)});e.total+=Number(r.score)}for(const e of exams.values()){const rank=await pool.query(`WITH totals AS (SELECT s.id,COALESCE(sum(m.score) FILTER(WHERE m.status='Approved'),0) AS total FROM school_exams ex JOIN school_students s ON s.school_owner_id=ex.school_owner_id AND s.class_name=ex.class_name AND (ex.stream='*' OR s.stream=ex.stream) AND s.status='Active' LEFT JOIN school_marks m ON m.exam_id=ex.id AND m.student_id=s.id WHERE ex.id=$1 AND ex.school_owner_id=$2 GROUP BY s.id) SELECT DENSE_RANK() OVER(ORDER BY total DESC) AS position FROM totals WHERE id=$3`,[e.id,x.schoolId,c.req.param("id")]);e.position=Number(rank.rows[0]?.position||0)}const terms=await pool.query(`SELECT e.term,e.academic_year AS "academicYear",sum(m.score) AS total FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.student_id=$1 AND m.school_owner_id=$2 AND m.status='Approved' GROUP BY e.term,e.academic_year ORDER BY e.academic_year,e.term`,[c.req.param("id"),x.schoolId]);return c.json([...exams.values()].flatMap(e=>e.marks.map(m=>({...m,exam:e.exam,term:e.term,academicYear:e.academicYear,position:e.position,total:e.total,schoolName:student.rows[0].schoolName}))))});
  app.get("/api/events",async(c)=>{const x=await guard(c,"view_announcements");if(!x)return c.json({error:"Not allowed to view school events."},403);return c.json((await pool.query(`SELECT id,title,details,location,starts_at AS "startsAt",author_name AS "authorName" FROM school_events WHERE school_owner_id=$1 AND starts_at>=now() ORDER BY starts_at LIMIT 20`,[x.schoolId])).rows)});
  app.post("/api/events",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"Not allowed to create school events."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;const startsAt=new Date(String(b?.startsAt||""));if(typeof b?.title!=="string"||!b.title.trim()||!Number.isFinite(startsAt.getTime())||startsAt<=new Date())return c.json({error:"Event title and a future date and time are required."},400);const r=await pool.query(`INSERT INTO school_events(school_owner_id,title,details,location,starts_at,author_user_id,author_name) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,details,location,starts_at AS "startsAt",author_name AS "authorName"`,[x.schoolId,b.title.trim(),String(b.details||"").trim(),String(b.location||"").trim(),startsAt.toISOString(),c.get("userId"),x.name]);return c.json(r.rows[0],201)});
  app.delete("/api/events/:id",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"Not allowed to delete school events."},403);await pool.query("DELETE FROM school_events WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);return c.json({ok:true})});
  app.get("/api/dashboard",async(c)=>{const x=await guard(c,"view_students");if(!x)return c.json({error:"Not allowed to view dashboard."},403);await pool.query("DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",[x.schoolId]);const r=await pool.query(`SELECT (SELECT count(*) FROM school_students WHERE school_owner_id=$1 AND status='Active') AS students,(SELECT count(*) FROM school_staff WHERE school_owner_id=$1 AND active) AS staff,(SELECT COALESCE(sum(credit),0) FROM school_fee_entries WHERE school_owner_id=$1 AND entry_type='Payment') AS paid,(SELECT COALESCE(sum(debit-credit),0) FROM school_fee_entries WHERE school_owner_id=$1) AS balance`,[x.schoolId]);return c.json(r.rows[0])});
}












