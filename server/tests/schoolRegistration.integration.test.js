// Opt-in integration test (same setup as auth.integration.test.js):
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test \
//   JWT_SECRET=test-secret PORT=5098 npm test
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const RUN_INTEGRATION = !!process.env.TEST_MONGO_URI;

describe("school registration (integration)", { skip: !RUN_INTEGRATION && "set TEST_MONGO_URI to run" }, () => {
  let app, mongoose, request, School, User;

  const schoolA = {
    schoolName: "Sunrise School",
    schoolEmail: "info@sunrise.test",
    firstName: "Anna",
    lastName: "Admin",
    email: "anna@sunrise.test",
    password: "password123",
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
    await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    await mongoose.connection.db.dropDatabase();
  });

  after(async () => {
    await mongoose.connection.close();
  });

  test("registers a school and makes the first user its admin", async () => {
    const res = await request(app).post("/api/schools/register").send(schoolA);
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "admin");
    assert.ok(res.body.token);

    const school = await School.findOne({ schoolEmail: schoolA.schoolEmail });
    assert.equal(school.status, "active");
    assert.equal(String(res.body.user.schoolId), String(school._id));
  });

  test("a second, different school can register too", async () => {
    const res = await request(app).post("/api/schools/register").send({
      ...schoolA,
      schoolName: "Hilltop School",
      schoolEmail: "info@hilltop.test",
      email: "bob@hilltop.test",
    });
    assert.equal(res.status, 201);
    assert.equal(await School.countDocuments(), 2);
  });

  test("rejects a duplicate school email", async () => {
    const res = await request(app)
      .post("/api/schools/register")
      .send({ ...schoolA, email: "other@sunrise.test" });
    assert.equal(res.status, 409);
  });

  test("rejects a duplicate admin email and does not leave a school behind", async () => {
    const before = await School.countDocuments();
    const res = await request(app)
      .post("/api/schools/register")
      .send({ ...schoolA, schoolEmail: "new@school.test" });
    assert.equal(res.status, 409);
    assert.equal(await School.countDocuments(), before);
  });

  test("cleans up the school when the admin is invalid (short password)", async () => {
    const before = await School.countDocuments();
    const res = await request(app).post("/api/schools/register").send({
      ...schoolA,
      schoolEmail: "third@school.test",
      email: "third@admin.test",
      password: "short",
    });
    assert.equal(res.status, 400);
    assert.equal(await School.countDocuments(), before);
    assert.equal(await User.countDocuments({ email: "third@admin.test" }), 0);
  });

  test("ignores a role sent in the request body", async () => {
    const res = await request(app).post("/api/schools/register").send({
      ...schoolA,
      schoolEmail: "fourth@school.test",
      email: "fourth@admin.test",
      role: "teacher",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "admin");
  });
});
