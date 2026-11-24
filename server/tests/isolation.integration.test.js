// Opt-in integration test: School A must never see or change School B's data.
// Covers students and teachers. tenantIsolation.full.integration.test.js covers every module.
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test \
//   JWT_SECRET=test-secret PORT=5097 npm test
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const RUN_INTEGRATION = !!process.env.TEST_MONGO_URI;

describe("school data isolation (integration)", { skip: !RUN_INTEGRATION && "set TEST_MONGO_URI to run" }, () => {
  let app, mongoose, request;
  let tokenA, tokenB; // admin tokens of School A and School B
  let studentB, teacherB, classB; // records that belong to School B

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const registerSchool = async (name, adminEmail) => {
    const res = await request(app).post("/api/schools/register").send({
      schoolName: name,
      schoolEmail: `info@${name}.test`,
      firstName: "Admin",
      lastName: name,
      email: adminEmail,
      password: "password123",
    });
    assert.equal(res.status, 201);
    return res.body.token;
  };

  before(async () => {
    process.env.MONGO_URI = process.env.TEST_MONGO_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.NODE_ENV = "test";
    request = require("supertest");
    app = require("../server");
    mongoose = require("mongoose");
    await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    await mongoose.connection.db.dropDatabase();

    tokenA = await registerSchool("schoola", "admin@schoola.test");
    tokenB = await registerSchool("schoolb", "admin@schoolb.test");

    // Create one student, one teacher and one class in School B
    const s = await request(app).post("/api/students").set(auth(tokenB))
      .send({ firstName: "Sam", lastName: "B", email: "sam@schoolb.test", studentId: "S-1" });
    studentB = s.body.student;
    const t = await request(app).post("/api/teachers").set(auth(tokenB))
      .send({ firstName: "Tina", lastName: "B", email: "tina@schoolb.test" });
    teacherB = t.body.teacher;
    const c = await request(app).post("/api/classes").set(auth(tokenB)).send({ name: "Grade 10A" });
    classB = c.body.class;
    assert.ok(studentB && teacherB && classB);
  });

  after(async () => {
    await mongoose.connection.close();
  });

  test("School A's lists do not contain School B's records", async () => {
    for (const path of ["students", "teachers"]) {
      const res = await request(app).get(`/api/${path}`).set(auth(tokenA));
      assert.equal(res.status, 200);
      assert.equal(res.body.pagination.total, 0, `${path} list should be empty for School A`);
    }
  });

  test("School A cannot read School B's student or teacher by id", async () => {
    for (const [path, id] of [["students", studentB._id], ["teachers", teacherB._id]]) {
      const res = await request(app).get(`/api/${path}/${id}`).set(auth(tokenA));
      assert.equal(res.status, 404, `${path}/${id}`);
    }
  });

  test("School A cannot update School B's records", async () => {
    for (const [path, id] of [["students", studentB._id], ["teachers", teacherB._id]]) {
      const res = await request(app).put(`/api/${path}/${id}`).set(auth(tokenA)).send({ firstName: "Hacked" });
      assert.equal(res.status, 404, `${path}/${id}`);
    }
    const stillSafe = await request(app).get(`/api/students/${studentB._id}`).set(auth(tokenB));
    assert.equal(stillSafe.body.student.user.firstName, "Sam");
  });

  test("School A cannot delete School B's records", async () => {
    for (const [path, id] of [["students", studentB._id], ["teachers", teacherB._id]]) {
      const res = await request(app).delete(`/api/${path}/${id}`).set(auth(tokenA));
      assert.equal(res.status, 404, `${path}/${id}`);
    }
    const stillThere = await request(app).get(`/api/students/${studentB._id}`).set(auth(tokenB));
    assert.equal(stillThere.status, 200);
  });

  test("School A cannot put its student into School B's class", async () => {
    const res = await request(app).post("/api/students").set(auth(tokenA))
      .send({ firstName: "Sue", lastName: "A", email: "sue@schoola.test", classId: classB._id });
    assert.equal(res.status, 400);
    // The failed request must not have left a user behind
    const retry = await request(app).post("/api/students").set(auth(tokenA))
      .send({ firstName: "Sue", lastName: "A", email: "sue@schoola.test" });
    assert.equal(retry.status, 201);
  });

  test("two schools can use the same studentId", async () => {
    const res = await request(app).post("/api/students").set(auth(tokenA))
      .send({ firstName: "Sam", lastName: "A", email: "sam@schoola.test", studentId: "S-1" });
    assert.equal(res.status, 201);
    // ...but the same school cannot use it twice
    const dup = await request(app).post("/api/students").set(auth(tokenA))
      .send({ firstName: "Dup", lastName: "A", email: "dup@schoola.test", studentId: "S-1" });
    assert.notEqual(dup.status, 201);
  });

  test("a schoolId sent in the request body is ignored", async () => {
    const User = require("../models/User");
    const School = require("../models/School");
    const schoolB = await School.findOne({ schoolEmail: "info@schoolb.test" });
    const res = await request(app).post("/api/teachers").set(auth(tokenA))
      .send({ firstName: "Evil", lastName: "A", email: "evil@schoola.test", schoolId: schoolB._id });
    assert.equal(res.status, 201);
    const created = await User.findOne({ email: "evil@schoola.test" });
    assert.notEqual(String(created.schoolId), String(schoolB._id));
  });
});
