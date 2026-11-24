> **Multi-tenant SaaS version:** this project now serves many schools from one backend and one database. See [SAAS_GUIDE.md](SAAS_GUIDE.md) for the architecture, setup, migration, testing and security notes. **The Parent Portal has been removed** (see "Parent Portal removal" in SAAS_GUIDE.md); the roles are now admin, teacher and student. The sections below are the original build log, edited so they no longer describe parent features.

# School Management & Communication System — Phases 1–10 (complete)

This is the foundation of the full MERN school system: working JWT auth,
role-based access control (admin/teacher/student), and a protected
React frontend that redirects each role to its own dashboard shell — plus
a real, data-backed Admin Dashboard.

## What's included in Phase 2 (new)

**Backend (`/server`)**
- `GET /api/admin/stats` — total students/teachers/admins (real,
  computed from the `User` collection), plus placeholders for stats that
  depend on models from later phases (`totalClasses`, `attendancePercentage`,
  `averageGrade`) — each flagged `available: false` with a `comingIn` note
  rather than being faked
- `GET /api/admin/recent-registrations` — most recently created users
- `GET /api/admin/user-growth` — monthly new-registration counts by role,
  last 6 months, dense series (zero-filled) for clean charting
- All three routes are `admin`-only via `protect` + `authorize("admin")`

**Frontend (`/client`)**
- Admin Dashboard is now real: 4 KPI stat cards, a stacked bar chart of
  monthly registrations by role (Recharts), a pie chart of user
  distribution, and a recent-registrations table
- `StatCard` renders an honest "—" + note for stats that aren't available
  yet, instead of showing a fake number
- `ComingSoonCard` clearly marks the Attendance / Grades / Announcements
  sections as pending their respective phases, so nothing on the dashboard
  is mocked data pretending to be real

## What's included in Phase 10 (new) — Security, Testing, Deployment

**Security hardening**
- **Closed a gap flagged since Phase 1**: `POST /api/auth/register` used
  to accept any role — anyone could self-register as a teacher, student,
  or even admin. It now only ever creates the school's *first* admin
  account (checked via `User.exists({})`) and is rejected with a clear
  403 afterward. Every other account is created by an admin through the
  Students/Teachers pages (Phase 3), each with an auto-generated
  temp password — matching how a real school actually onboards people.
  The Register page's copy and layout were updated to match (no more
  role picker)
- Added a dedicated rate limiter for file uploads (separate budget from
  the general API limiter — uploads are more expensive and a common
  abuse vector)
- Fixed `helmet`'s default `crossOriginResourcePolicy` (which defaults to
  same-origin) so the client can actually load files from `/uploads`
  across the dev ports — everything else stays at helmet's secure
  defaults
- Full checklist against the original spec's Security section — all
  present: password hashing (bcrypt), JWT auth, protected routes,
  role-based authorization, input validation, MongoDB injection
  protection (`express-mongo-sanitize`), XSS protection (`xss-clean` +
  helmet), CORS locked to `CLIENT_URL`, rate limiting, secure httpOnly
  cookies (with `secure`/`sameSite` set correctly for production), and
  secrets living only in `.env` (never committed, never returned in any
  API response)

**Testing (`server/tests/`)**
- 20 unit tests for the pure-logic utilities that matter most for
  correctness — grade calculations (weighted percentage vs. unweighted
  average, all 5 letter-grade boundaries, missing-component handling)
  and the unique-code generator's retry/collision logic. These run with
  zero setup: `cd server && npm test`
- A guarded integration suite (`auth.integration.test.js`) exercises the
  real register/login/protected-route flow end-to-end against an actual
  MongoDB instance via `supertest`. It's opt-in — skipped by default so
  `npm test` never needs a database — run it with:
  ```
  TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test npm test
  ```

**Deployment**
- `server/Dockerfile`, `client/Dockerfile` (multi-stage: Vite build →
  served by nginx), and a root `docker-compose.yml` wiring up MongoDB +
  API + client with persistent volumes for both the database and
  uploaded attachments
- One command to run the whole stack locally or on a VM:
  ```
  cp server/.env.example server/.env   # fill in JWT_SECRET at minimum
  docker compose up --build
  ```
  App at `http://localhost:8080`, API at `http://localhost:5000`
- For a real production deployment: put a real domain + HTTPS in front
  (reverse proxy or your cloud provider's load balancer), swap the
  bundled Mongo container for a managed instance, and set
  `VITE_API_URL`/`CLIENT_URL` to your real domains (Vite bakes
  `VITE_API_URL` in at *build* time — see the build arg in
  `client/Dockerfile`)

## Project status: 10 implementation phases documented
Every phase from the original plan has been built: Auth + Roles, Admin
Dashboard, Students/Teachers, Classes + Subjects, Attendance,
Assignments, Grades, Messaging + Notifications, Reports + Analytics, and
now Security/Testing/Deployment. The two intentionally-deferred items are
called out in their respective phase notes above (scheduled-job-based
deadline reminders, and announcement-triggered notifications pending a
future Announcement module) — everything else in the spec is implemented
and wired together.

## What's included in Phase 9 (new)

**Backend (`/server`)**
- `GET /api/reports/attendance-trend?classId=&subjectId=&months=` —
  monthly attendance % over time for a class (optionally one subject),
  zero-filled so the line chart has no gaps, same pattern as the Admin
  Dashboard's registration-growth chart from Phase 2
- `GET /api/reports/grade-distribution?classId=&subjectId=` — counts of
  A/B/C/D/F across a class+subject, or school-wide for admins with no
  filters
- `GET /api/reports/class-comparison` (admin only) — every class's
  30-day attendance % and average grade % side by side, for spotting
  which classes are struggling
- `GET /api/reports/attendance/export` and `/api/reports/grades/export` —
  real CSV downloads (not JSON) of a class's attendance summary or
  gradebook, built with proper CSV escaping, no extra library needed
- All of these reuse `assertClassAccess` (same shape as the
  `assertTeachingAssignment` helper from Phase 5/6/7): admins see
  everything, teachers only see classes they're actually assigned to

**Frontend (`/client`)**
- **Admin → Reports**: class comparison bar chart (attendance vs. grade
  per class), an attendance trend line chart with class/subject filters,
  a grade distribution pie chart with class/subject filters, and CSV
  export buttons for both
- **Teacher → Reports**: the same trend/distribution charts, scoped to
  the teacher's own classes and subjects, with the same CSV export
  buttons

This phase intentionally builds only on data that already exists from
Phases 5–7 (Attendance, Assignments, Grades) — no new data-entry surface,
just better ways to see and export what's already been recorded.

## Try Phase 9
- As admin, go to **Reports** → the class comparison chart should show
  real numbers for any class where you've taken attendance and entered
  grades in earlier phases
- Pick a class in the attendance trend filter → you should see this
  month's percentage plotted (previous months will be empty if this is a
  fresh dataset — that's expected, not a bug)
- Pick a class+subject in the grade distribution filter → see the letter
  breakdown → click Export CSV → a real spreadsheet downloads
- Log in as a teacher → **Reports** → same charts, but the class dropdown
  only shows classes that teacher is actually assigned to

## What's included in Phase 8 (new)

**Backend (`/server`)**
- `Conversation` and `Message` models (1:1 conversations only — matches
  the pairwise Student↔Teacher / Admin↔Teacher structure, not group chat)
- `Notification` model, with a `createNotification()` helper that both
  saves to the DB and pushes live over the recipient's socket if they're
  connected
- Socket.IO shares the same HTTP server as the REST API (`server.js` now
  wraps Express in `http.createServer`). Every socket authenticates with
  the same JWT used for API calls; each user joins a personal room
  (`user:<id>`) so events can reach them on any device/tab without the
  server knowing what page they're on
- `utils/messagingContacts.js` enforces who's actually allowed to message
  whom — derived from real relationships: a student's allowed contacts
  are the teachers actually assigned to their class; a teacher's are their
  students and admins; admin can message any teacher
- Full messaging API: contacts, conversations (with unread counts +
  online status), start conversation, get/send messages, mark-read
- Notification triggers wired into every controller from earlier phases:
  new message → recipient notified in real time; new assignment created →
  every student in the class notified; assignment graded → that student
  notified; grade posted → that student notified; marked absent → that
  student notified. (Not included: "assignment deadline approaching" and
  announcement-triggered notifications — the former needs a scheduled
  job, the latter needs the Announcement module from Phase 17, neither of
  which exist yet)

**Frontend (`/client`)**
- **Messages** (in the navbar, available to every role): a two-pane
  inbox — conversation list with unread badges and online indicators on
  the left, active chat on the right (collapses to a single pane with a
  back button on mobile). "New" opens a contact picker scoped to who
  you're actually allowed to message. Messages arrive live via Socket.IO,
  no polling
- Notification bell in the navbar: real unread count, dropdown list,
  click-to-navigate-and-mark-read, "mark all read", and a toast +
  instant badge update when a new notification arrives over the socket

## Try Phase 8
- Log in as the teacher from earlier phases (assigned to a class) → click
  the message icon → New → you should see their students and any admins
  as contacts → start a conversation
- Open a second browser (or incognito window), log in as one of those
  students → **Messages** → you'll see the conversation the teacher
  started, and can reply — it should appear on the teacher's screen
  instantly without a refresh
- Take attendance and mark someone absent, or grade an assignment → log
  in as that student → the notification bell shows it immediately (both
  windows open side by side makes this easiest to see)

## What's included in Phase 7 (new)

**Backend (`/server`)**
- `Grade` model — one document per (student, subject, class), holding four
  fixed score components: `assignment`, `quiz`, `midterm`, `final` (each an
  optional `{score, maxScore}`), matching the spec's example exactly. Note:
  this is a **separate, teacher-entered gradebook** — it doesn't
  auto-pull scores from Phase 6's Assignment submissions, so a teacher's
  "Assignment" column here is their own summary judgment, not a mirror of
  every individual assignment grade. Keeping the two decoupled avoided a
  lot of cross-module complexity for comparatively little benefit
- Totals/percentage/average/letter-grade are **never stored** — they're
  computed on every read from the raw scores (`utils/gradeCalculations.js`),
  so they can't drift out of sync if a score is edited later.
  Letter cutoffs match the spec: 90+ A, 80+ B, 70+ C, 60+ D, below 60 F
- `PUT /api/grades` and `PUT /api/grades/bulk` — same
  `assertTeachingAssignment` authorization as Attendance/Assignments (a
  teacher can only grade a class+subject they're assigned to)
- `GET /api/grades/class/:classId/report` — full gradebook for a class:
  every enrolled student with their current scores, for the teacher's
  gradebook table
- `GET /api/grades/student/:studentId` and `GET /api/grades/me` —
  same read-access pattern as Attendance/Assignments (admin, the
  student's teachers, or the student themself — never writable by the
  student)
- Admin Dashboard's **Average Grade** stat is now real — computed across
  every entered grade in the system

**Frontend (`/client`)**
- **Teacher → Grades**: pick class → subject, get an editable gradebook
  table — one row per student, one column per component, with an editable
  max-points header per column (applies class-wide) and a live
  percentage/letter shown per row as you type. "Save All" bulk-saves the
  whole table in one request
- **Student → Grades**: read-only cards per subject showing each
  component's score, the overall percentage, letter grade, and the
  unweighted average
- The Student dashboard now shows a real "Average Grade" card / Grades link
  instead of a placeholder

## Try Phase 7
- As the teacher from Phase 5/6, go to **Grades** → pick the class/subject
  → enter some Assignment/Quiz/Midterm/Final scores (adjust the max-points
  header if you want a different scale) → Save All
- Log in as one of those students → **Grades** → see the breakdown,
  percentage, and letter grade
- Back in Admin Dashboard, the **Average Grade** card now shows a real
  percentage instead of "—"

## What's included in Phase 6 (new)

**Backend (`/server`)**
- `Assignment` model (title, description, subject, class, teacher, dueDate,
  maxPoints, attachments) and `Submission` model (one per student per
  assignment — text response + attachments, status, grade, feedback)
- Real file uploads: `POST /api/uploads/assignment` and
  `/api/uploads/submission` (multer, local disk storage under
  `server/uploads/`, 10MB/5-file limit, extension allowlist), served
  statically at `/uploads/...` (outside `/api`, since it's static assets
  not JSON). The frontend uploads files first, gets back `{url,
  originalName, size}`, then includes those in the create/submit call
- `POST /api/assignments` — same teaching-assignment check as Attendance
  (extracted into a shared `assertTeachingAssignment` helper, now used by
  both Attendance and Assignments so the authorization logic can't drift
  between the two)
- `GET /api/assignments` — scoped by role: teacher sees their own
  (enriched with submission/grading-progress stats), student sees their
  class's assignments enriched with **their own computed status**
  (`pending` if not yet due, `late` if overdue, `submitted`/`graded` once
  they've acted)
- `POST /api/assignments/:id/submit` — student submits (or resubmits,
  until graded); rejects submissions for the wrong class or after grading
- `PUT /api/assignments/:id/submissions/:submissionId/grade` — teacher
  (owner) or admin sets grade + feedback, which locks the status to
  `graded` and blocks further resubmission

**Frontend (`/client`)**
- **Teacher → Assignments**: create/edit assignments (class → subject
  dropdown filtered to what that teacher actually teaches there, due date,
  max points, file attachments), a **View Submissions** panel per
  assignment showing every student's submission with inline grading
- **Student → Assignments**: list with status badges
  (Pending/Submitted/Late/Graded), a submit modal (text response + file
  attachments), and grade/feedback shown once graded
- Teacher/Student dashboards now show a real "Awaiting Grading" /
  "Assignments Pending" count instead of a placeholder

## Try Phase 6
- As the teacher from Phase 5 (assigned to a class+subject with students
  on the roster), go to **Assignments** → Add Assignment → attach a file
  if you like → set a due date
- Log in as one of that class's students → **Assignments** → see it as
  Pending → Submit (with a text response and/or a file) → status updates
- Back as the teacher → **Assignments** → View Submissions → grade it
- Log in as the student again → the assignment now shows the grade and
  feedback.

## What's included in Phase 5 (new)

**Backend (`/server`)**
- `Attendance` model — one document per (class, subject, date) "session"
  holding a `records` array of `{ student, status }`, where status is
  `present | absent | late | excused` (matches the spec exactly)
- `POST /api/attendance` — take or update attendance for a session. A
  teacher can only submit for a class+subject they're actually assigned to
  teach (checked against `Class.subjects`); admins can submit for any
  assignment. Every student ID is verified to actually belong to that
  class before saving
- `GET /api/attendance/session` — fetch an existing session (pre-fills the
  take-attendance screen when re-opening a date that's already been marked)
- `GET /api/attendance/class/:classId/report` — per-student attendance %
  summary for a class over a date range, for admins/assigned teachers
- `GET /api/attendance/student/:studentId` — one student's full history +
  percentage, accessible to admins, the student's teachers, or the student
  themself
- `GET /api/attendance/me` — convenience wrapper: resolves the logged-in
  student's own record without the frontend needing to know the
  underlying Student ID
- New self-service endpoint `GET /api/teachers/me` so a teacher can fetch
  their own assigned classes without needing admin access
- Admin Dashboard's **Attendance (30d)** stat is now real — computed from
  actual attendance records over the trailing 30 days

**Frontend (`/client`)**
- **Teacher → Take Attendance**: pick class → subject (filtered to only
  subjects that teacher is assigned for that class) → date, then mark each
  student Present/Absent/Late/Excused (with a "mark all" shortcut).
  Re-opening an already-recorded date loads the existing marks for editing
- **Student → My Attendance**: attendance % summary + full history table
- Student/Teacher dashboards now show real attendance data (or a
  "My Classes" list + a Take Attendance shortcut, for teachers) instead of
  the Phase 1 placeholder text

## Try Phase 5
- As admin, make sure at least one Class has a subject assigned to a
  teacher (Phase 4's Classes → Manage), and that class has students on
  its roster
- Log in as that teacher → **Take Attendance** in the sidebar → pick the
  class/subject/today's date → mark students → Save
- Log in as one of those students → **My Attendance** → see the
  percentage and the session you just recorded
- Back in Admin Dashboard, the **Attendance (30d)** card now shows a real
  percentage instead of "—"

## What's included in Phase 4 (new)

**Backend (`/server`)**
- `Subject` model (name, code, description) — admin CRUD at `/api/subjects`
- `Class` model (name, academic year, homeroom `classTeacher`, and an
  embedded `subjects: [{ subject, teacher }]` list capturing which teacher
  teaches which subject *for that specific class*) — admin CRUD at
  `/api/classes`, plus:
  - `PUT /api/classes/:id/subjects` — replace the subject↔teacher assignments
  - `PUT /api/classes/:id/students` — replace the class roster
- `Student.class` is now actively set/cleared as students are assigned to
  classes; `Teacher.classes` / `Teacher.subjects` (empty placeholders since
  Phase 3) now get populated automatically — a `recomputeTeacherAssignments`
  helper rebuilds them from the source of truth (`Class` documents)
  whenever an assignment changes, so they can't drift out of sync
- Deleting a Subject cascades: removed from every Class's subject list and
  every Teacher's subject list. Deleting a Class un-assigns its students
  and cleans up affected teachers' `classes`/`subjects` — it does not
  delete the students or teachers themselves
- Admin Dashboard's **Total Classes** stat is now real (was a placeholder)

**Frontend (`/client`)**
- New Admin sidebar links: **Classes**, **Subjects**
- Subjects page: simple CRUD table (name, code, description)
- Classes page: CRUD table (name, academic year, homeroom teacher) plus a
  **Manage** modal per class for:
  - assigning subject↔teacher pairs (add/remove rows, pick from dropdowns)
  - checking students on/off the class roster (shows a warning badge if a
    student is already in a different class)
- Students page: Add/Edit form now includes a **Class** dropdown, and the
  table shows each student's assigned class
- Teachers table now shows each teacher's assigned **Classes** and
  **Subjects** columns (read from the same source of truth as above)

## Try Phase 4
- Go to **Subjects** → add a few (e.g. Mathematics/MATH101, English/ENG101)
- Go to **Classes** → add a class (e.g. "Grade 10A"), optionally pick a
  homeroom teacher
- Click **Manage** on that class → add subject rows and assign teachers to
  each → save → check the **Teachers** page, their Classes/Subjects columns
  now reflect it
- Still in Manage, check a few students onto the roster → save → check the
  **Students** page, their Class column now shows the assignment
- Open **Admin Dashboard** → "Total Classes" now shows a real number

## What's included in Phase 3 (new)

**Backend (`/server`)**
- `Student`, `Teacher` models — each holds only role-specific
  fields (studentId, employeeId, dateOfBirth, gender...) and
  references its `User` for the shared profile fields, so nothing is
  duplicated
- Full admin-only CRUD for both: `/api/students`, `/api/teachers`
  (list with search + status filter + pagination, get one, create, update,
  delete)
- Creating a student/teacher creates their `User` login account too.
  If you don't supply a password, one is auto-generated and returned once
  in the response for the admin to share
- `studentId` / `employeeId` are auto-generated (`STU2026xxxx`,
  `EMP2026xxxx`) if not provided, guaranteed unique
- Deleting a student/teacher removes both their profile doc and their
  `User` login

**Frontend (`/client`)**
- New Admin sidebar links: **Students**, **Teachers**
- Each is a full management page: searchable/filterable/paginated table,
  an Add/Edit modal (React Hook Form), and a delete confirmation dialog
- New temp-password toast shown after creating an account (since these
  roles don't self-register)

## Try Phase 3
- Log in as admin → open **Students** or **Teachers** in the sidebar
- Add a Teacher first (no dependencies), then a few Students
- Edit a Student's details or class and confirm the change shows in the list
- Delete a Student and confirm they disappear from the list and from their
  class roster

## What's included in Phase 1

**Backend (`/server`)**
- Express + MongoDB (Mongoose) API
- `User` model (single collection, `role` field) with bcrypt password hashing
- JWT auth via httpOnly cookie **and** bearer token (works either way)
- Endpoints: register, login, logout, get current user, update profile,
  change password, forgot password (email), reset password
- `protect` + `authorize(...roles)` middleware for route-level RBAC
- Security: helmet, CORS, rate limiting, mongo-sanitize, xss-clean, centralized error handler

**Frontend (`/client`)**
- React + Vite + Tailwind + DaisyUI
- `AuthContext` (Context API) — session persists across refresh
- Login, Register, Forgot Password, Reset Password pages (React Hook Form)
- `ProtectedRoute` with optional `allowedRoles` — redirects to `/login` or `/unauthorized`
- Role-based redirect after login (`/admin/dashboard`, `/teacher/dashboard`, etc.)
- Shared `DashboardLayout` (Navbar + Sidebar) used by all four roles
- Placeholder dashboards per role + Profile / Change Password pages

## Getting started

### 1. Backend
```bash
cd server
cp .env.example .env    # then fill in MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev              # http://localhost:5000
```

### 2. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

### 3. Try it
- Go to `http://localhost:5173/register`, create an account with any role
- You'll be redirected to the matching dashboard
- Refresh the page — you stay logged in
- Try visiting another role's dashboard URL directly — you'll be redirected to `/unauthorized`
- `GET /api/health` confirms the API is running
- `GET /api/admin/ping` (etc.) confirm role middleware works end-to-end

## Notes / decisions made for you
- `POST /api/auth/register` was open to every role so Phase 1
  is testable standalone. In a real deployment you'd likely restrict
  teacher/student account creation to admins (Phase 2's User
  Management) and only leave the first Admin self-registerable — flagged
  in `authController.js`.
- `User` is one collection with a `role` enum rather than four separate
  collections, so auth logic doesn't duplicate. Role-specific data
  (classes taught, children, grades...) will live in their own collections
  in later phases, referencing `User._id`.
- Cloudinary, Socket.IO, and Nodemailer are wired into the dependency list
  and `sendEmail.js` already degrades gracefully if unconfigured — but
  actual image upload / real-time messaging come in later phases per the
  phase plan (5–8).

## Try Phase 2
- Register 3-4 accounts across different roles (see Phase 1 instructions above)
- Log in as the `admin` account → you'll land on `/admin/dashboard`
- You should see real counts, a registrations-by-month chart, a role
  distribution pie chart, and a recent registrations table
- "Total Classes" and the three bottom cards intentionally show placeholder
  states — that's expected until their phases are built

## Next steps beyond this plan
The system is feature-complete per your original 10-phase spec. If you
want to keep going, natural extensions would be: the Announcement module
(referenced but deferred in Phases 8/9), scheduled-job-based deadline
reminders, Cloudinary integration for profile photos (currently
`profileImage` is just a URL string field with no upload flow), and a
seed-data script for demo/test accounts (mentioned in Phase 1 but not
yet built). Let me know if you'd like any of these.
# school-management
# school-management
# school-management
