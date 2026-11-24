// Integration tests against a real (test) MongoDB instance via supertest.
// Opt-in: skipped entirely unless TEST_MONGO_URI is set, so `npm test`
// stays fast and dependency-free by default (the unit tests alongside
// this file always run). To exercise these:
//
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017/school-management-test \
//   JWT_SECRET=test-secret PORT=5099 npm test
//
// Uses a disposable database — every run starts by dropping it.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const RUN_INTEGRATION = !!process.env.TEST_MONGO_URI;

describe("auth flow (integration)", { skip: !RUN_INTEGRATION && "set TEST_MONGO_URI to run" }, () => {
  let app;
  let mongoose;
  let request;

  before(async () => {
    process.env.MONGO_URI = process.env.TEST_MONGO_URI;
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.NODE_ENV = "test";

    request = require("supertest");
    app = require("../server");
    mongoose = require("mongoose");

    // Wait for the connection server.js kicks off on require, then start clean.
    await new Promise((resolve) => mongoose.connection.once("connected", resolve));
    await mongoose.connection.db.dropDatabase();
  });

  after(async () => {
    await mongoose.connection.close();
  });

  test("GET /api/health responds ok", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  test("school registration creates an admin and returns a token", async () => {
    const res = await request(app).post("/api/schools/register").send({
      schoolName: "Test School",
      schoolEmail: "info@school.test",
      firstName: "First",
      lastName: "Admin",
      email: "admin@school.test",
      password: "password123",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "admin");
    assert.ok(res.body.token);
  });

  test("the old /api/auth/register route no longer exists", async () => {
    const res = await request(app).post("/api/auth/register").send({
      firstName: "Second",
      lastName: "User",
      email: "someone-else@school.test",
      password: "password123",
    });
    assert.equal(res.status, 404);
  });

  test("login with wrong password is rejected", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@school.test", password: "wrong-password" });
    assert.equal(res.status, 401);
  });

  test("protected route without a token is rejected", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
  });

  test("login with correct credentials succeeds and unlocks a protected route", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@school.test", password: "password123" });
    assert.equal(loginRes.status, 200);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.email, "admin@school.test");
  });
  test("the JWT contains the user's schoolId", async () => {
    const jwt = require("jsonwebtoken");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@school.test", password: "password123" });
    const decoded = jwt.verify(loginRes.body.token, process.env.JWT_SECRET);
    assert.equal(String(decoded.schoolId), String(loginRes.body.user.schoolId));
  });

  test("a token without schoolId is rejected", async () => {
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const user = await User.findOne({ email: "admin@school.test" });
    const oldStyleToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${oldStyleToken}`);
    assert.equal(res.status, 401);
  });

  test("a deactivated school cannot log in or use an existing token", async () => {
    const School = require("../models/School");
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@school.test", password: "password123" });
    const token = loginRes.body.token;

    await School.updateOne({ schoolEmail: "info@school.test" }, { status: "inactive" });

    const loginAgain = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@school.test", password: "password123" });
    assert.equal(loginAgain.status, 403);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(meRes.status, 403);

    // Turn the school back on so other tests are not affected
    await School.updateOne({ schoolEmail: "info@school.test" }, { status: "active" });
    const meAgain = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(meAgain.status, 200);
  });
});
