# Learning Hub

The LMS is part of the existing Shule Yetu school portal. It uses the school's current class, stream, subject, student, teacher, and school profile records.

## Database setup

The LMS schema is additive. Apply the migrations with the direct Neon connection string available to the project:

```powershell
node --env-file=.env.local migrations/apply.mjs
```

The migration runner uses `DATABASE_URL_UNPOOLED`. The deployed Neon Function needs the existing Neon database and Object Storage environment variables configured for the app.

## Staff workflow

1. Sign in to the staff portal and open **Learning (LMS)**.
2. Choose a class, subject, and (for teachers) an assigned stream.
3. Add topics and create written notes, video links, or learning file resources. Set each item to draft or published.
4. Add reusable questions to the school's question bank.
5. Create timed quizzes and online exams by selecting questions from the same class and subject. Set the duration, attempt limit, optional open and close times, and publish when ready. Release results to students when appropriate.
6. Create assignments with instructions, due dates, late submission rules, and resubmission rules. Students can submit written responses, files, or both; review their work and save marks and feedback.
7. Read student discussion questions and reply in their class forum.

Administrators can select students or generate LMS accounts for a class. Download the temporary password CSV immediately; the app stores only salted scrypt password hashes and does not display the generated passwords again. Give each student their admission number and temporary password. Students sign in at `/student-login` and must change the temporary password on first sign-in. Administrators reset forgotten passwords by generating a new temporary password.

To set up parent learning access, enter the guardian email on each linked student's school record, then use **Parent learning access** on the LMS page to generate a parent login. The parent account links every active student in that school with the same guardian email. Share the one-time temporary password securely; parents sign in at `/parent-login` and change it on first use. Parent dashboards show learning activity, assignment submissions and marks, approved exam scores, and released online assessment scores. If a guardian email is changed, that parent's dashboard immediately stops showing the student.

Learning-file uploads are limited to 20 MB. Supported formats include PDF, Office documents, common image/audio/video formats, ZIP, and plain text. Files are stored with randomized private object keys; the API returns short-lived download URLs only after checking the student's class, stream, subject, and publication status.

## Student workflow

Students sign in using their admission number and the password issued by the school. If admission numbers overlap between schools, include the school name on the sign-in form. The student dashboard shows published materials, assignments, and timed assessments for the student's active class, stream, and subjects. Assessment deadlines are enforced by the server and answers save to the database. Multiple choice, true/false, short answer, and fill-in-the-blank responses are checked automatically by normalized text comparison; essay and matching responses need teacher review. Assignment submissions accept written responses, PDF and Office documents, common image formats, ZIP, and plain text files up to 20 MB. Private file links expire after five minutes and are issued only to the student who submitted the file or staff assigned to that class, stream, and subject. Opening notes, marking materials complete, and downloading resources update the student's learning activity. Video time is an estimate based on the dashboard remaining visible with a video selected; it does not verify playback. Students can ask or answer questions in their class discussion forum.

Student sessions expire after 24 hours. Five failed logins lock an account for 15 minutes; an administrator password reset clears the lock.

## Current scope

The current LMS includes teacher/admin learning content, private file upload/download, student admission-number sign-in, progress tracking, a reusable question bank, timed assessment attempts, class discussions, and text-based assignment submission and marking.

Assessment-result exports and notification delivery are not implemented yet. The existing school exams and marks pages remain separate from these LMS question-bank assessments.
