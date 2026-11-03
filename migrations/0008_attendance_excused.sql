ALTER TABLE school_attendance DROP CONSTRAINT IF EXISTS school_attendance_status_check;
ALTER TABLE school_attendance ADD CONSTRAINT school_attendance_status_check
  CHECK (status IN ('Present','Absent','Late','Excused'));