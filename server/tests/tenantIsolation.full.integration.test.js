// Full multi-school security test (opt-in, needs MongoDB):
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test \
//   JWT_SECRET=test-secret PORT=5096 npm test
//
// It builds two complete schools (A and B) and checks that nothing leaks from
// one to the other - for every module - plus student/teacher rules, deactivated
// schools, private uploads and the platform owner.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const RUN_INTEGRATION = !!process.env.TEST_MONGO_URI;

describe("full multi-school isolation (integration)", { skip: !RUN_INTEGRATION && "set TEST_MONGO_URI to run" }, () => {
  let app, mongoose, request, School, User, Notification;
  let A, B; // fixtures of School A and School B
  let ownerToken;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const PASSWORD = "password123";

  const login = async (email) => {
    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    assert.equal(res.status, 200, `login ${email}`);
    return res.body.token;
  };

  // Builds one full school: admin, subject, teacher, class and 2 students
  const buildSchool = async (key) => {
    const reg = await request(app).post("/api/schools/register").send({
      schoolName: `School ${key}`, schoolEmail: `info@${key}.test`,
      firstName: "Admin", lastName: key, email: `admin@${key}.test`, password: PASSWORD,
    });
    assert.equal(reg.status, 201);
    const adminToken = reg.body.token;
    const school = await School.findOne({ schoolEmail: `info@${key}.test` });

    // The SAME subject code and class name in both schools must be allowed.
    const subject = (await request(app).post("/api/subjects").set(auth(adminToken))
      .send({ name: "Math", code: "MATH" })).body.subject;
    const teacher = (await request(app).post("/api/teachers").set(auth(adminToken))
      .send({ firstName: "Tina", lastName: key, email: `teacher@${key}.test`, password: PASSWORD })).body.teacher;
    const cls = (await request(app).post("/api/classes").set(auth(adminToken))
      .send({ name: "Grade 10A", academicYear: "2026" })).body.class;
    assert.ok(subject && teacher && cls, `fixtures for ${key}`);

    await request(app).put(`/api/classes/${cls._id}/subjects`).set(auth(adminToken))
      .send({ subjects: [{ subjectId: subject._id, teacherId: teacher._id }] });

    const student = (await request(app).post("/api/students").set(auth(adminToken))
      .send({ firstName: "Sam", lastName: key, email: `student@${key}.test`, password: PASSWORD, classId: cls._id })).body.student;
    const otherStudent = (await request(app).post("/api/students").set(auth(adminToken))
      .send({ firstName: "Olga", lastName: key, email: `other@${key}.test`, password: PASSWORD, classId: cls._id })).body.student;
    assert.ok(student && otherStudent, `people for ${key}`);

    return {
      key, schoolId: String(school._id), adminToken, subject, teacher, cls, student, otherStudent,
      teacherToken: await login(`teacher@${key}.test`),
      studentToken: await login(`student@${key}.test`),
    };
  };

  before(async () => {
    process.env.MONGO_URI = process.env.TEST_MONGO_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.NODE_ENV = "test";
    request = require("supertest");
    app = require("../server");
    mongoose = require("mongoose");
    School = require("../models/School");
    User = require("../models/User");
    Notification = require("../models/Notification");
    await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    await mongoose.connection.db.dropDatabase();
    await Promise.all([User.init(), School.init()]);

    A = await buildSchool("schoola");
    B = await buildSchool("schoolb");

    // Data created in each school
    for (const S of [A, B]) {
      await request(app).post("/api/attendance").set(auth(S.teacherToken)).send({
        classId: S.cls._id, subjectId: S.subject._id, date: "2026-11-02",
        records: [{ studentId: S.student._id, status: "absent" }, { studentId: S.otherStudent._id, status: "present" }],
      });
      const assignment = (await request(app).post("/api/assignments").set(auth(S.teacherToken)).send({
        title: `Homework ${S.key}`, classId: S.cls._id, subjectId: S.subject._id,
        dueDate: "2030-01-01", maxPoints: 20,
      })).body.assignment;
      S.assignment = assignment;
      await request(app).put("/api/grades").set(auth(S.teacherToken)).send({
        studentId: S.student._id, classId: S.cls._id, subjectId: S.subject._id,
        components: { quiz: { score: 8, maxScore: 10 } },
      });
      const conv = (await request(app).post("/api/messages/conversations").set(auth(S.studentToken))
        .send({ userId: S.teacher.user._id })).body.conversation;
      S.conversation = conv;
      await request(app).post(`/api/messages/conversations/${conv._id}/messages`).set(auth(S.studentToken))
        .send({ text: `Hello from ${S.key}` });
    }

    // The platform owner is created directly (there is no public sign-up for it)
    await User.create({
      firstName: "Plat", lastName: "Owner", email: "owner@platform.test",
      password: PASSWORD, role: "platform_owner",
    });
    ownerToken = await login("owner@platform.test");
  });

  after(async () => {
    await mongoose.connection.close();
  });

  // ---------- classes & subjects ----------
  test("classes and subjects: School A only sees its own and cannot touch School B's", async () => {
    const list = await request(app).get("/api/classes").set(auth(A.adminToken));
    assert.deepEqual(list.body.classes.map((c) => c._id), [A.cls._id]);
    const subjects = await request(app).get("/api/subjects").set(auth(A.adminToken));
    assert.deepEqual(subjects.body.subjects.map((s) => s._id), [A.subject._id]);

    assert.equal((await request(app).get(`/api/classes/${B.cls._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).put(`/api/classes/${B.cls._id}`).set(auth(A.adminToken)).send({ name: "X" })).status, 404);
    assert.equal((await request(app).delete(`/api/classes/${B.cls._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).get(`/api/subjects/${B.subject._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).delete(`/api/subjects/${B.subject._id}`).set(auth(A.adminToken))).status, 404);
  });

  test("a class cannot use another school's subject, teacher or student", async () => {
    const badSubject = await request(app).put(`/api/classes/${A.cls._id}/subjects`).set(auth(A.adminToken))
      .send({ subjects: [{ subjectId: B.subject._id, teacherId: A.teacher._id }] });
    assert.equal(badSubject.status, 400);
    const badTeacher = await request(app).put(`/api/classes/${A.cls._id}/subjects`).set(auth(A.adminToken))
      .send({ subjects: [{ subjectId: A.subject._id, teacherId: B.teacher._id }] });
    assert.equal(badTeacher.status, 400);
    const badStudent = await request(app).put(`/api/classes/${A.cls._id}/students`).set(auth(A.adminToken))
      .send({ studentIds: [B.student._id] });
    assert.equal(badStudent.status, 400);
    const badClassTeacher = await request(app).post("/api/classes").set(auth(A.adminToken))
      .send({ name: "Grade 11", classTeacherId: B.teacher._id });
    assert.equal(badClassTeacher.status, 400);
  });

  // ---------- students / teachers (School A cannot access School B) ----------
  test("School A cannot access School B's students or teachers", async () => {
    for (const [path, id] of [["students", B.student._id], ["teachers", B.teacher._id]]) {
      assert.equal((await request(app).get(`/api/${path}/${id}`).set(auth(A.adminToken))).status, 404, path);
    }
    const students = await request(app).get("/api/students").set(auth(A.adminToken));
    assert.equal(students.body.pagination.total, 2);
  });

  // ---------- attendance ----------
  test("attendance: no cross-school reads or writes", async () => {
    // Writing into B's class with A's admin
    const write = await request(app).post("/api/attendance").set(auth(A.adminToken)).send({
      classId: B.cls._id, subjectId: A.subject._id, date: "2026-11-03",
      records: [{ studentId: B.student._id, status: "present" }],
    });
    assert.equal(write.status, 404);
    // Using B's subject with A's class
    const subjectWrite = await request(app).post("/api/attendance").set(auth(A.adminToken)).send({
      classId: A.cls._id, subjectId: B.subject._id, date: "2026-11-03",
      records: [{ studentId: A.student._id, status: "present" }],
    });
    assert.equal(subjectWrite.status, 400);
    // Reading
    assert.equal((await request(app).get(`/api/attendance/student/${B.student._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).get(`/api/attendance/class/${B.cls._id}/report`).set(auth(A.adminToken))).status, 404);
    const session = await request(app).get("/api/attendance/session").set(auth(A.adminToken))
      .query({ classId: B.cls._id, subjectId: B.subject._id, date: "2026-11-02" });
    assert.equal(session.status, 404);
  });

  // ---------- students ----------
  test("students only see their own data", async () => {
    // Own data works
    assert.equal((await request(app).get("/api/attendance/me").set(auth(A.studentToken))).status, 200);
    assert.equal((await request(app).get(`/api/grades/student/${A.student._id}`).set(auth(A.studentToken))).status, 200);
    // Another student of the SAME school is refused
    assert.equal((await request(app).get(`/api/attendance/student/${A.otherStudent._id}`).set(auth(A.studentToken))).status, 403);
    assert.equal((await request(app).get(`/api/grades/student/${A.otherStudent._id}`).set(auth(A.studentToken))).status, 403);
    // A student of ANOTHER school does not exist for them
    assert.equal((await request(app).get(`/api/attendance/student/${B.student._id}`).set(auth(A.studentToken))).status, 404);
    assert.equal((await request(app).get(`/api/grades/student/${B.student._id}`).set(auth(A.studentToken))).status, 404);
    // Students cannot use admin or teacher endpoints
    assert.equal((await request(app).get("/api/students").set(auth(A.studentToken))).status, 403);
    assert.equal((await request(app).get("/api/teachers").set(auth(A.studentToken))).status, 403);
  });

  // ---------- the Parent Portal is gone ----------
  test("parent routes no longer exist and old parent accounts cannot log in", async () => {
    assert.equal((await request(app).get("/api/parents").set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).get("/api/parent/ping").set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).put(`/api/students/${A.student._id}/parents`).set(auth(A.adminToken)).send({ parentIds: [] })).status, 404);

    // An old account from before the removal (inserted directly, bypassing validation)
    const bcrypt = require("bcryptjs");
    const inserted = await User.collection.insertOne({
      firstName: "Old", lastName: "Parent", email: "oldparent@schoola.test",
      password: await bcrypt.hash(PASSWORD, 4), role: "parent",
      schoolId: new mongoose.Types.ObjectId(A.schoolId), status: "active",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const loginRes = await request(app).post("/api/auth/login").send({ email: "oldparent@schoola.test", password: PASSWORD });
    assert.equal(loginRes.status, 403);

    // ...and an old token of such an account is refused too
    const jwt = require("jsonwebtoken");
    const oldToken = jwt.sign({ id: inserted.insertedId, role: "parent", schoolId: A.schoolId }, process.env.JWT_SECRET);
    assert.equal((await request(app).get("/api/auth/me").set(auth(oldToken))).status, 403);
    assert.equal((await request(app).get("/api/assignments").set(auth(oldToken))).status, 403);
    await User.collection.deleteOne({ _id: inserted.insertedId });
  });

  // ---------- grades ----------
  test("grades: School A cannot read or write School B's grades", async () => {
    assert.equal((await request(app).get(`/api/grades/student/${B.student._id}`).set(auth(A.adminToken))).status, 404);
    const report = await request(app).get(`/api/grades/class/${B.cls._id}/report`).set(auth(A.adminToken)).query({ subjectId: B.subject._id });
    assert.equal(report.status, 404);
    const write = await request(app).put("/api/grades").set(auth(A.adminToken)).send({
      studentId: B.student._id, classId: A.cls._id, subjectId: A.subject._id,
      components: { quiz: { score: 1, maxScore: 10 } },
    });
    assert.equal(write.status, 404);
    // Admin of A using B's subject id must not create a grade row
    const foreignSubject = await request(app).put("/api/grades").set(auth(A.adminToken)).send({
      studentId: A.student._id, classId: A.cls._id, subjectId: B.subject._id,
      components: { quiz: { score: 1, maxScore: 10 } },
    });
    assert.equal(foreignSubject.status, 400);
    // The student only sees their own grades
    const mine = await request(app).get("/api/grades/me").set(auth(A.studentToken));
    assert.equal(mine.body.grades.length, 1);
  });

  // ---------- assignments ----------
  test("assignments: no cross-school access, and attachments must be from the own school", async () => {
    const list = await request(app).get("/api/assignments").set(auth(A.adminToken));
    assert.deepEqual(list.body.assignments.map((a) => a.title), ["Homework schoola"]);

    assert.equal((await request(app).get(`/api/assignments/${B.assignment._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).put(`/api/assignments/${B.assignment._id}`).set(auth(A.adminToken)).send({ title: "x" })).status, 404);
    assert.equal((await request(app).delete(`/api/assignments/${B.assignment._id}`).set(auth(A.adminToken))).status, 404);
    assert.equal((await request(app).post(`/api/assignments/${B.assignment._id}/submit`).set(auth(A.studentToken)).send({ textResponse: "hi" })).status, 404);

    const evilAttachment = await request(app).post("/api/assignments").set(auth(A.teacherToken)).send({
      title: "With foreign file", classId: A.cls._id, subjectId: A.subject._id, dueDate: "2030-01-01",
      attachments: [{ url: `/uploads/${B.schoolId}/assignments/secret.pdf`, originalName: "secret.pdf", size: 1 }],
    });
    assert.equal(evilAttachment.status, 400);
  });

  // ---------- teachers ----------
  test("teachers cannot reach admin data or other classes", async () => {
    assert.equal((await request(app).get("/api/students").set(auth(A.teacherToken))).status, 403);
    assert.equal((await request(app).get("/api/teachers").set(auth(A.teacherToken))).status, 403);
    assert.equal((await request(app).get(`/api/teachers/${B.teacher._id}`).set(auth(A.teacherToken))).status, 403);
    // Teacher B tries to read School A's class
    assert.equal((await request(app).get(`/api/attendance/class/${A.cls._id}/report`).set(auth(B.teacherToken))).status, 404);
    assert.equal((await request(app).get(`/api/grades/student/${A.student._id}`).set(auth(B.teacherToken))).status, 404);
    // A teacher of School A who is NOT assigned to the class
    const loner = await request(app).post("/api/teachers").set(auth(A.adminToken))
      .send({ firstName: "No", lastName: "Class", email: "loner@schoola.test", password: PASSWORD });
    assert.equal(loner.status, 201);
    const lonerToken = await login("loner@schoola.test");
    assert.equal((await request(app).get(`/api/attendance/class/${A.cls._id}/report`).set(auth(lonerToken))).status, 403);
    assert.equal((await request(app).get(`/api/grades/student/${A.student._id}`).set(auth(lonerToken))).status, 403);
  });

  // ---------- messages & notifications ----------
  test("messages: no cross-school contacts or conversations", async () => {
    const contacts = await request(app).get("/api/messages/contacts").set(auth(A.adminToken));
    const ids = contacts.body.contacts.map((c) => String(c.userId));
    assert.ok(!ids.includes(String(B.teacher.user._id)));
    assert.ok(!ids.includes(String(B.student.user._id)));

    const start = await request(app).post("/api/messages/conversations").set(auth(A.adminToken)).send({ userId: B.teacher.user._id });
    assert.equal(start.status, 403);

    assert.equal((await request(app).get(`/api/messages/conversations/${A.conversation._id}/messages`).set(auth(B.studentToken))).status, 404);
    assert.equal((await request(app).get(`/api/messages/conversations/${A.conversation._id}/messages`).set(auth(B.teacherToken))).status, 404);
    const send = await request(app).post(`/api/messages/conversations/${A.conversation._id}/messages`).set(auth(B.teacherToken)).send({ text: "intruder" });
    assert.equal(send.status, 404);
    const mine = await request(app).get("/api/messages/conversations").set(auth(A.studentToken));
    assert.equal(mine.body.conversations.length, 1);
  });

  test("notifications: stored with the school and never visible to another school", async () => {
    const aNotes = await request(app).get("/api/notifications").set(auth(A.studentToken));
    assert.ok(aNotes.body.notifications.length > 0);
    assert.ok(aNotes.body.notifications.every((n) => String(n.schoolId) === A.schoolId));

    const bNotes = await request(app).get("/api/notifications").set(auth(B.studentToken));
    assert.ok(bNotes.body.notifications.every((n) => String(n.schoolId) === B.schoolId));

    const aNoteId = aNotes.body.notifications[0]._id;
    assert.equal((await request(app).put(`/api/notifications/${aNoteId}/read`).set(auth(B.studentToken))).status, 404);
    assert.equal(await Notification.countDocuments({ schoolId: { $exists: false } }), 0);
  });

  // ---------- reports & dashboard ----------
  test("reports and admin dashboard only count the own school", async () => {
    assert.equal((await request(app).get("/api/reports/attendance-trend").set(auth(A.adminToken)).query({ classId: B.cls._id })).status, 404);
    assert.equal((await request(app).get("/api/reports/grade-distribution").set(auth(A.adminToken)).query({ classId: B.cls._id })).status, 404);
    assert.equal((await request(app).get("/api/reports/attendance/export").set(auth(A.adminToken)).query({ classId: B.cls._id })).status, 404);
    assert.equal((await request(app).get("/api/reports/grades/export").set(auth(A.adminToken)).query({ classId: B.cls._id, subjectId: B.subject._id })).status, 404);

    const comparison = await request(app).get("/api/reports/class-comparison").set(auth(A.adminToken));
    assert.deepEqual(comparison.body.rows.map((r) => r.classId), [A.cls._id]);

    const distribution = await request(app).get("/api/reports/grade-distribution").set(auth(A.adminToken));
    const total = Object.values(distribution.body.distribution).reduce((a, b) => a + b, 0);
    assert.equal(total, 1); // only School A's single grade

    const statsA = await request(app).get("/api/admin/stats").set(auth(A.adminToken));
    assert.equal(statsA.body.stats.totalStudents, 2);
    assert.equal(statsA.body.stats.totalClasses.value, 1);
    const recent = await request(app).get("/api/admin/recent-registrations").set(auth(A.adminToken)).query({ limit: 50 });
    assert.ok(recent.body.users.every((u) => u.email.endsWith("@schoola.test")));
  });

  // ---------- uploads ----------
  test("uploads are private to each school", async () => {
    const upload = await request(app).post("/api/uploads/assignment").set(auth(A.teacherToken))
      .attach("files", Buffer.from("hello"), "note.txt");
    assert.equal(upload.status, 201);
    const url = upload.body.attachments[0].url;
    assert.ok(url.startsWith(`/uploads/${A.schoolId}/assignments/`));

    assert.equal((await request(app).get(url).set(auth(A.studentToken))).status, 200);
    assert.equal((await request(app).get(url).set(auth(B.teacherToken))).status, 403);
    assert.equal((await request(app).get(url)).status, 401);
    // The old public layout is gone
    assert.equal((await request(app).get("/uploads/assignments/note.txt").set(auth(A.studentToken))).status, 403);

    // The uploaded file can be attached to an assignment of the same school
    const ok = await request(app).post("/api/assignments").set(auth(A.teacherToken)).send({
      title: "With file", classId: A.cls._id, subjectId: A.subject._id, dueDate: "2030-01-01",
      attachments: upload.body.attachments,
    });
    assert.equal(ok.status, 201);
  });

  // ---------- security basics ----------
  test("role and school cannot be changed through the API", async () => {
    const profile = await request(app).put("/api/auth/profile").set(auth(A.adminToken))
      .send({ firstName: "Still", role: "platform_owner", schoolId: B.schoolId });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.role, "admin");
    assert.equal(String(profile.body.user.schoolId), A.schoolId);

    const edit = await request(app).put("/api/schools/me").set(auth(A.adminToken))
      .send({ schoolName: "Renamed A", status: "inactive", schoolEmail: "x@x.test" });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.school.schoolName, "Renamed A");
    assert.equal(edit.body.school.status, "active");
    assert.equal(edit.body.school.schoolEmail, "info@schoola.test");
    // Only admins may edit the school
    assert.equal((await request(app).put("/api/schools/me").set(auth(A.teacherToken)).send({ schoolName: "Hack" })).status, 403);
  });

  test("login and registration refuse objects instead of text (NoSQL injection)", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    assert.ok([400, 401].includes(loginRes.status));
    const registerRes = await request(app).post("/api/schools/register").send({
      schoolName: "X", schoolEmail: { $gt: "" }, firstName: "a", lastName: "b", email: "x@x.test", password: PASSWORD,
    });
    assert.equal(registerRes.status, 400);
  });

  // ---------- platform owner ----------
  test("platform owner: lists schools but cannot use school features; school users cannot use platform routes", async () => {
    const stats = await request(app).get("/api/platform/stats").set(auth(ownerToken));
    assert.equal(stats.status, 200);
    assert.equal(stats.body.stats.totalSchools, 2);
    assert.equal(stats.body.stats.activeSchools, 2);

    const schools = await request(app).get("/api/platform/schools").set(auth(ownerToken));
    assert.equal(schools.body.schools.length, 2);
    assert.equal(schools.body.schools.find((s) => String(s._id) === A.schoolId).userCounts.student, 2);

    const one = await request(app).get(`/api/platform/schools/${A.schoolId}`).set(auth(ownerToken));
    assert.equal(one.body.school.admin.email, "admin@schoola.test");

    const search = await request(app).get("/api/platform/schools").set(auth(ownerToken)).query({ search: "schoolb" });
    assert.equal(search.body.schools.length, 1);

    assert.equal((await request(app).get("/api/auth/me").set(auth(ownerToken))).status, 200);
    for (const url of ["/api/students", "/api/classes", "/api/notifications", "/api/admin/stats", "/api/messages/contacts"]) {
      assert.equal((await request(app).get(url).set(auth(ownerToken))).status, 403, url);
    }
    for (const token of [A.adminToken, A.teacherToken, A.studentToken]) {
      assert.equal((await request(app).get("/api/platform/stats").set(auth(token))).status, 403);
      assert.equal((await request(app).patch(`/api/platform/schools/${B.schoolId}/status`).set(auth(token)).send({ status: "inactive" })).status, 403);
    }
    assert.equal((await request(app).get("/api/platform/stats")).status, 401);
  });

  test("platform owner: invalid status values are refused", async () => {
    const res = await request(app).patch(`/api/platform/schools/${A.schoolId}/status`).set(auth(ownerToken)).send({ status: "deleted" });
    assert.equal(res.status, 400);
  });

  // ---------- deactivated schools (keep this test last: it changes School A) ----------
  test("a deactivated school cannot use the application, other schools are not affected", async () => {
    const off = await request(app).patch(`/api/platform/schools/${A.schoolId}/status`).set(auth(ownerToken)).send({ status: "inactive" });
    assert.equal(off.status, 200);
    assert.equal(off.body.school.status, "inactive");

    // Existing tokens stop working immediately - for every role
    for (const token of [A.adminToken, A.teacherToken, A.studentToken]) {
      assert.equal((await request(app).get("/api/auth/me").set(auth(token))).status, 403);
    }
    assert.equal((await request(app).get("/api/students").set(auth(A.adminToken))).status, 403);
    // Private files too
    assert.equal((await request(app).get(`/uploads/${A.schoolId}/assignments/x.txt`).set(auth(A.studentToken))).status, 403);
    // New logins are refused
    const again = await request(app).post("/api/auth/login").send({ email: "admin@schoola.test", password: PASSWORD });
    assert.equal(again.status, 403);
    // School B keeps working
    assert.equal((await request(app).get("/api/students").set(auth(B.adminToken))).status, 200);

    const stats = await request(app).get("/api/platform/stats").set(auth(ownerToken));
    assert.equal(stats.body.stats.inactiveSchools, 1);

    // Activate again
    const on = await request(app).patch(`/api/platform/schools/${A.schoolId}/status`).set(auth(ownerToken)).send({ status: "active" });
    assert.equal(on.status, 200);
    assert.equal((await request(app).get("/api/students").set(auth(A.adminToken))).status, 200);
  });
});
