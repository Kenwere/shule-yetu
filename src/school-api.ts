import type { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

type ApiEnv = { Variables: { userId: string; userEmail: string; userName: string } };
type Context = { schoolId: string; role: string; permissions: string[]; name: string };
type Permission = "view_students" | "edit_students" | "view_fees" | "edit_fees" | "manage_staff" | "view_classes" | "edit_classes" | "manage_settings" | "view_announcements" | "manage_announcements" | "view_attendance" | "edit_attendance" | "view_exams" | "edit_exams";
const allPermissions: Permission[] = ["view_students","edit_students","view_fees","edit_fees","manage_staff","view_classes","edit_classes","manage_settings","view_announcements","manage_announcements","view_attendance","edit_attendance","view_exams","edit_exams"];
const rolePermissions: Record<string, Permission[]> = {
  Admin: allPermissions,
  Teacher: ["view_students","view_classes","view_announcements","view_attendance","edit_attendance","view_exams","edit_exams"],
  Accountant: ["view_students","view_fees","edit_fees","view_classes","view_announcements"],
};

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
  async function guard(c: any, permission: Permission): Promise<Context | null> {
    const context = await contextFor(c);
    if (!context) { c.status(403); c.header("content-type", "application/json"); return null; }
    if (context.role !== "Admin" && !context.permissions.includes(permission)) { c.status(403); c.header("content-type", "application/json"); return null; }
    return context;
  }

  app.get("/api/me", async (c) => {
    const context = await contextFor(c);
    if (!context) return c.json({ error: "This account is not attached to a school." }, 403);
    const profile = await pool.query("SELECT school_name, school_type, contact_email, phone, address, website, motto FROM school_profiles WHERE user_id = $1", [context.schoolId]);
    return c.json({ userId: c.get("userId"), email: c.get("userEmail"), name: context.name, role: context.role, permissions: context.permissions, school: profile.rows[0] ?? null });
  });

  app.get("/api/school-profile", async (c) => {
    const context = await guard(c, "manage_settings");
    if (!context) return c.json({ error: "Not allowed to view school settings." }, 403);
    const result = await pool.query("SELECT school_name, school_type, contact_email, phone, address, website, motto FROM school_profiles WHERE user_id = $1", [context.schoolId]);
    return c.json(result.rows[0] ?? null);
  });
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
    const vals = ["schoolName","schoolType","email","phone","address","website","motto"].map((key) => typeof body[key] === "string" ? (body[key] as string).trim() : "");
    const result = await pool.query("UPDATE school_profiles SET school_name=$2, school_type=$3, contact_email=$4, phone=$5, address=$6, website=$7, motto=$8, updated_at=now() WHERE user_id=$1 RETURNING school_name, school_type, contact_email, phone, address, website, motto", [context.schoolId, ...vals]);
    return c.json(result.rows[0]);
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
    const adm = typeof b.adm === "string" && b.adm.trim() ? b.adm.trim() : `SY-${randomUUID().slice(0,8).toUpperCase()}`;
    const vals = [b.gender,b.dob,b.class,b.stream,b.guardian,b.phone,b.address,b.admitted,b.status].map((v) => typeof v === "string" ? v : "");
    try {
      const result = await pool.query(
        `INSERT INTO school_students (school_owner_id,admission_no,first_name,last_name,gender,date_of_birth,class_name,stream,guardian,phone,address,admitted_on,status)
         VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,$7,$8,$9,$10,$11,COALESCE(NULLIF($12,'')::date,CURRENT_DATE),COALESCE(NULLIF($13,''),'Active'))
         ON CONFLICT (school_owner_id,admission_no) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,gender=EXCLUDED.gender,date_of_birth=EXCLUDED.date_of_birth,class_name=EXCLUDED.class_name,stream=EXCLUDED.stream,guardian=EXCLUDED.guardian,phone=EXCLUDED.phone,address=EXCLUDED.address,status=EXCLUDED.status
         RETURNING id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, phone, address, admitted_on AS admitted, status`,
        [context.schoolId,adm,b.first.trim(),b.last.trim(),...vals],
      );
      return c.json(result.rows[0], 201);
    } catch (error) { return c.json({ error: "Could not save the student. Check the admission number and dates." }, 400); }
  });
  app.get("/api/students/:id", async (c) => {
    const context = await guard(c, "view_students"); if (!context) return c.json({ error: "Not allowed to view students." }, 403);
    const student = await pool.query("SELECT id, admission_no AS adm, first_name AS first, last_name AS last, gender, date_of_birth AS dob, class_name AS class, stream, guardian, phone, address, admitted_on AS admitted, status FROM school_students WHERE id=$1 AND school_owner_id=$2", [c.req.param("id"),context.schoolId]);
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const fees = await pool.query("SELECT id, entry_date AS date, term, entry_type AS entry, debit, credit, method, reference, comment FROM school_fee_entries WHERE student_id=$1 AND school_owner_id=$2 ORDER BY entry_date DESC,created_at DESC", [c.req.param("id"),context.schoolId]);
    return c.json({ student: student.rows[0], fees: fees.rows });
  });
  app.post("/api/students/:id/fees", async (c) => {
    const context = await guard(c, "edit_fees"); if (!context) return c.json({ error: "Not allowed to record fees." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b || typeof b.entry !== "string" || !["Fee obligation","Payment","Debt added","Credit added","Balance set"].includes(b.entry) || typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) return c.json({ error: "Choose a valid fee entry and amount." }, 400);
    const student = await pool.query("SELECT id FROM school_students WHERE id=$1 AND school_owner_id=$2", [c.req.param("id"),context.schoolId]);
    if (!student.rowCount) return c.json({ error: "Student not found." }, 404);
    const debit = ["Fee obligation","Debt added"].includes(b.entry) ? b.amount : 0;
    const credit = ["Payment","Credit added"].includes(b.entry) ? b.amount : 0;
    const result = await pool.query("INSERT INTO school_fee_entries (school_owner_id,student_id,term,entry_type,debit,credit,method,reference,comment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, entry_date AS date, term, entry_type AS entry, debit, credit, method, reference, comment", [context.schoolId,c.req.param("id"),typeof b.term === "string" ? b.term : "",b.entry,debit,credit,typeof b.method === "string" ? b.method : "",typeof b.reference === "string" ? b.reference : "",typeof b.comment === "string" ? b.comment : ""]);
    return c.json(result.rows[0],201);
  });

  app.delete("/api/students/:id", async (c) => {
    const context = await guard(c, "edit_students"); if (!context) return c.json({ error: "Not allowed to edit students." }, 403);
    await pool.query("DELETE FROM school_students WHERE id=$1 AND school_owner_id=$2", [c.req.param("id"),context.schoolId]);
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
  app.get("/api/attendance", async (c) => {
    const context=await guard(c,"view_attendance"); if(!context)return c.json({error:"Not allowed to view attendance."},403);
    const date=String(c.req.query("date")||new Date().toISOString().slice(0,10));
    const result=await pool.query(`SELECT s.id,s.admission_no AS adm,s.first_name AS first,s.last_name AS last,s.class_name AS class,s.stream,a.status
      FROM school_students s LEFT JOIN school_attendance a ON a.student_id=s.id AND a.attendance_date=$2
      WHERE s.school_owner_id=$1 AND s.status='Active' ORDER BY s.class_name,s.last_name,s.first_name`,[context.schoolId,date]);
    return c.json(result.rows);
  });
  app.post("/api/attendance",async(c)=>{
    const context=await guard(c,"edit_attendance");if(!context)return c.json({error:"Not allowed to edit attendance."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    if(typeof b?.studentId!=="string"||!['Present','Absent','Late'].includes(String(b.status)))return c.json({error:"Choose a student and valid attendance status."},400);
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
    const context = await guard(c, "manage_staff"); if (!context) return c.json({ error: "Only school administrators can invite staff." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b || typeof b.email !== "string" || !b.email.includes("@") || typeof b.name !== "string" || !b.name.trim()) return c.json({ error: "A name and valid email are required." }, 400);
    const role = typeof b.role === "string" && b.role in rolePermissions && b.role !== "Admin" ? b.role : "Teacher";
    const requested = Array.isArray(b.permissions) ? b.permissions.filter((p): p is Permission => allPermissions.includes(p as Permission)) : rolePermissions[role];
    const inviteCode = randomUUID();
    try {
      const result = await pool.query("INSERT INTO school_invites (school_owner_id,invite_code,email,full_name,role,permissions) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (school_owner_id,email) DO UPDATE SET invite_code=EXCLUDED.invite_code,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,expires_at=now()+interval '7 days' RETURNING invite_code,email,full_name,role,expires_at", [context.schoolId,inviteCode,b.email.trim().toLowerCase(),b.name.trim(),role,JSON.stringify(requested)]);
      return c.json(result.rows[0],201);
    } catch { return c.json({ error: "That email is already registered with this school." },409); }
  });
  app.patch("/api/staff/:id", async (c) => {
    const context = await guard(c, "manage_staff"); if (!context) return c.json({ error: "Only school administrators can update staff." }, 403);
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const permissions = Array.isArray(b?.permissions) ? b.permissions.filter((p): p is Permission => allPermissions.includes(p as Permission)) : [];
    const role = typeof b?.role === "string" && b.role in rolePermissions ? b.role : "Teacher";
    const result = await pool.query("UPDATE school_staff SET role=$3,permissions=$4::jsonb,active=COALESCE($5::boolean,active) WHERE user_id=$1 AND school_owner_id=$2 AND role<>'Admin' RETURNING user_id AS id,email,full_name AS name,role,permissions,active", [c.req.param("id"),context.schoolId,role,JSON.stringify(permissions),typeof b?.active === "boolean" ? b.active : null]);
    if (!result.rowCount) return c.json({ error: "Staff member not found or protected." },404);
    return c.json(result.rows[0]);
  });
  app.post("/api/staff/accept-invite", async (c) => {
    const b = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (typeof b?.code !== "string") return c.json({ error: "Invitation code required." },400);
    const email = String(c.get("userEmail") || "").toLowerCase();
    const invite = await pool.query("DELETE FROM school_invites WHERE invite_code=$1 AND lower(email)=$2 AND expires_at>now() RETURNING school_owner_id,email,full_name,role,permissions", [b.code,email]);
    if (!invite.rowCount) return c.json({ error: "Invitation is invalid, expired, or for another email." },400);
    const i = invite.rows[0];
    await pool.query("INSERT INTO school_staff (user_id,school_owner_id,email,full_name,role,permissions) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (user_id) DO UPDATE SET school_owner_id=EXCLUDED.school_owner_id,email=EXCLUDED.email,full_name=EXCLUDED.full_name,role=EXCLUDED.role,permissions=EXCLUDED.permissions,active=true", [c.get("userId"),i.school_owner_id,i.email,i.full_name,i.role,JSON.stringify(i.permissions)]);
    return c.json({ ok: true, schoolOwnerId:i.school_owner_id });
  });

  app.get("/api/classes", async (c) => {
    const context = await guard(c,"view_classes"); if(!context) return c.json({error:"Not allowed to view classes."},403);
    return c.json((await pool.query("SELECT id,name,streams,subjects,term_fee AS \"termFee\",extra_fee AS \"extraFee\" FROM school_classes WHERE school_owner_id=$1 ORDER BY name",[context.schoolId])).rows);
  });
  app.post("/api/classes", async (c) => {
    const context=await guard(c,"edit_classes"); if(!context) return c.json({error:"Not allowed to edit classes."},403);
    const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;
    if(typeof b?.name!=="string"||!b.name.trim()) return c.json({error:"Class name is required."},400);
    const strings=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];
    const r=await pool.query("INSERT INTO school_classes (school_owner_id,name,streams,subjects,term_fee,extra_fee) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6) ON CONFLICT(school_owner_id,name) DO UPDATE SET streams=EXCLUDED.streams,subjects=EXCLUDED.subjects,term_fee=EXCLUDED.term_fee,extra_fee=EXCLUDED.extra_fee RETURNING id,name,streams,subjects,term_fee AS \"termFee\",extra_fee AS \"extraFee\"",[context.schoolId,b.name.trim(),JSON.stringify(strings(b.streams)),JSON.stringify(strings(b.subjects)),Number(b.termFee)||0,Number(b.extraFee)||0]);
    return c.json(r.rows[0],201);
  });
  app.post("/api/classes/generate-fees",async(c)=>{const x=await guard(c,"edit_fees");if(!x)return c.json({error:"Not allowed to generate fee obligations."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;const term=typeof b?.term==="string"?b.term:"";if(!term)return c.json({error:"Term is required."},400);const r=await pool.query(`INSERT INTO school_fee_entries (school_owner_id,student_id,term,entry_type,debit,comment)
    SELECT s.school_owner_id,s.id,$2,'Fee obligation',c.term_fee+c.extra_fee,c.name||' class fees'
    FROM school_students s JOIN school_classes c ON c.school_owner_id=s.school_owner_id AND c.name=s.class_name
    WHERE s.school_owner_id=$1 AND s.status='Active' RETURNING id`,[x.schoolId,term]);return c.json({created:r.rowCount})});  app.delete("/api/classes/:id", async (c)=>{const x=await guard(c,"edit_classes");if(!x)return c.json({error:"Not allowed."},403);await pool.query("DELETE FROM school_classes WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);return c.json({ok:true})});

  app.get("/api/announcements",async(c)=>{const x=await guard(c,"view_announcements");if(!x)return c.json({error:"Not allowed to view announcements."},403);await pool.query("DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",[x.schoolId]);return c.json((await pool.query("SELECT id,title,body,author_name AS \"authorName\",created_at AS \"createdAt\",expires_at AS \"expiresAt\" FROM school_announcements WHERE school_owner_id=$1 AND expires_at>now() ORDER BY created_at DESC",[x.schoolId])).rows)});
  app.post("/api/announcements",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"You do not have permission to create announcements."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;if(typeof b?.title!=="string"||!b.title.trim()||typeof b.body!=="string"||!b.body.trim())return c.json({error:"Title and announcement are required."},400);const expiry=new Date(String(b.expiresAt||""));if(!Number.isFinite(expiry.getTime())||expiry<=new Date())return c.json({error:"Choose a future expiry date."},400);const r=await pool.query("INSERT INTO school_announcements (school_owner_id,title,body,author_user_id,author_name,expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,title,body,author_name AS \"authorName\",created_at AS \"createdAt\",expires_at AS \"expiresAt\"",[x.schoolId,b.title.trim(),b.body.trim(),c.get("userId"),x.name,expiry.toISOString()]);return c.json(r.rows[0],201)});
  app.delete("/api/announcements/:id",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"You do not have permission to delete announcements."},403);await pool.query("DELETE FROM school_announcements WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);return c.json({ok:true})});

  app.get("/api/exams", async (c) => { const x = await guard(c,"view_exams"); if (!x) return c.json({error:"Not allowed to view exams."},403); return c.json((await pool.query(`SELECT e.id,e.name,e.class_name AS "className",e.stream,e.term,e.starts_on AS "startsOn",e.ends_on AS "endsOn",count(m.id) FILTER (WHERE m.status='Pending') AS pending FROM school_exams e LEFT JOIN school_marks m ON m.exam_id=e.id WHERE e.school_owner_id=$1 GROUP BY e.id ORDER BY e.created_at DESC`,[x.schoolId])).rows); });
  app.post("/api/exams", async (c) => { const x = await guard(c,"edit_exams"); if (!x) return c.json({error:"Not allowed to create exams."},403); const b = await c.req.json().catch(()=>null) as Record<string,unknown>|null; if (typeof b?.name!=="string"||typeof b.className!=="string"||typeof b.startsOn!=="string"||typeof b.endsOn!=="string"||b.endsOn<b.startsOn) return c.json({error:"Exam name, class, and valid dates are required."},400); const cls=await pool.query("SELECT subjects FROM school_classes WHERE school_owner_id=$1 AND name=$2",[x.schoolId,b.className]); if (!cls.rowCount) return c.json({error:"Choose a class configured in this school."},400); const result=await pool.query("INSERT INTO school_exams(school_owner_id,name,class_name,stream,term,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[x.schoolId,b.name.trim(),b.className,String(b.stream||""),String(b.term||""),b.startsOn,b.endsOn]); const id=result.rows[0].id; await pool.query(`INSERT INTO school_marks(school_owner_id,exam_id,student_id,subject,score,entered_by) SELECT $1,$2,s.id,sub.value,0,$3 FROM school_students s CROSS JOIN LATERAL jsonb_array_elements_text($4::jsonb) AS sub(value) WHERE s.school_owner_id=$1 AND s.class_name=$5 AND s.stream=$6 AND s.status='Active' ON CONFLICT(exam_id,student_id,subject) DO NOTHING`,[x.schoolId,id,c.get("userId"),JSON.stringify(cls.rows[0].subjects||[]),b.className,String(b.stream||"")]); return c.json({id},201); });
  app.get("/api/exams/:id/marks", async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed."},403);const r=await pool.query(`SELECT m.id,s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id AND s.school_owner_id=m.school_owner_id JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.exam_id=$1 AND m.school_owner_id=$2 ORDER BY s.last_name,s.first_name,m.subject`,[c.req.param("id"),x.schoolId]);return c.json(r.rows)});
  app.patch("/api/marks/:id",async(c)=>{const x=await guard(c,"edit_exams");if(!x)return c.json({error:"Not allowed to edit marks."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;const score=Number(b?.score);const status=b?.status;if(!Number.isFinite(score)||score<0||score>100||!['Pending','Approved','Denied'].includes(String(status)))return c.json({error:"Score must be between 0 and 100 and status must be valid."},400);const r=await pool.query(`UPDATE school_marks m SET score=$3,status=$4 FROM school_exams e WHERE m.id=$1 AND m.school_owner_id=$2 AND e.id=m.exam_id AND e.school_owner_id=m.school_owner_id RETURNING m.id`,[c.req.param("id"),x.schoolId,score,status]);if(!r.rowCount)return c.json({error:"Mark not found."},404);return c.json((await pool.query("SELECT m.id,s.first_name||' '||s.last_name AS student,s.admission_no AS adm,m.subject,m.score,m.status FROM school_marks m JOIN school_students s ON s.id=m.student_id WHERE m.id=$1",[c.req.param("id")])).rows[0])});
  app.get("/api/students/:id/report-card",async(c)=>{const x=await guard(c,"view_exams");if(!x)return c.json({error:"Not allowed to view report cards."},403);const r=await pool.query(`SELECT e.name AS exam,e.term,m.subject,m.score FROM school_marks m JOIN school_exams e ON e.id=m.exam_id AND e.school_owner_id=m.school_owner_id WHERE m.student_id=$1 AND m.school_owner_id=$2 AND m.status='Approved' ORDER BY e.created_at,m.subject`,[c.req.param("id"),x.schoolId]);return c.json(r.rows)});
  app.get("/api/events",async(c)=>{const x=await guard(c,"view_announcements");if(!x)return c.json({error:"Not allowed to view school events."},403);return c.json((await pool.query(`SELECT id,title,details,location,starts_at AS "startsAt",author_name AS "authorName" FROM school_events WHERE school_owner_id=$1 AND starts_at>=now() ORDER BY starts_at LIMIT 20`,[x.schoolId])).rows)});
  app.post("/api/events",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"Not allowed to create school events."},403);const b=await c.req.json().catch(()=>null) as Record<string,unknown>|null;const startsAt=new Date(String(b?.startsAt||""));if(typeof b?.title!=="string"||!b.title.trim()||!Number.isFinite(startsAt.getTime())||startsAt<=new Date())return c.json({error:"Event title and a future date and time are required."},400);const r=await pool.query(`INSERT INTO school_events(school_owner_id,title,details,location,starts_at,author_user_id,author_name) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,details,location,starts_at AS "startsAt",author_name AS "authorName"`,[x.schoolId,b.title.trim(),String(b.details||"").trim(),String(b.location||"").trim(),startsAt.toISOString(),c.get("userId"),x.name]);return c.json(r.rows[0],201)});
  app.delete("/api/events/:id",async(c)=>{const x=await guard(c,"manage_announcements");if(!x)return c.json({error:"Not allowed to delete school events."},403);await pool.query("DELETE FROM school_events WHERE id=$1 AND school_owner_id=$2",[c.req.param("id"),x.schoolId]);return c.json({ok:true})});
  app.get("/api/dashboard",async(c)=>{const x=await guard(c,"view_students");if(!x)return c.json({error:"Not allowed to view dashboard."},403);await pool.query("DELETE FROM school_announcements WHERE school_owner_id=$1 AND expires_at<=now()",[x.schoolId]);const r=await pool.query(`SELECT (SELECT count(*) FROM school_students WHERE school_owner_id=$1 AND status='Active') AS students,(SELECT count(*) FROM school_staff WHERE school_owner_id=$1 AND active) AS staff,(SELECT COALESCE(sum(credit),0) FROM school_fee_entries WHERE school_owner_id=$1 AND entry_type='Payment') AS paid,(SELECT COALESCE(sum(debit-credit),0) FROM school_fee_entries WHERE school_owner_id=$1) AS balance`,[x.schoolId]);return c.json(r.rows[0])});
}