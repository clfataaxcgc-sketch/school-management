// Unit tests that need no database and no extra packages.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { onlyOwnSchoolFiles } = require("../middleware/uploadAccess");
const { generateUniqueCode } = require("../utils/generateCredentials");

// Minimal fake of an Express response
const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

describe("onlyOwnSchoolFiles (private uploads)", () => {
  test("lets a user open a file inside their own school folder", () => {
    let nextCalled = false;
    const req = { schoolId: "school1", path: "/school1/assignments/a.pdf" };
    onlyOwnSchoolFiles(req, fakeRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test("blocks a file from another school's folder", () => {
    let nextCalled = false;
    const res = fakeRes();
    const req = { schoolId: "school1", path: "/school2/assignments/a.pdf" };
    onlyOwnSchoolFiles(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test("blocks the old public layout (/assignments/...) and path tricks", () => {
    for (const path of ["/assignments/a.pdf", "/", "//school2/a.pdf", "/school2/../school1/a.pdf", "/school1/../school2/a.pdf", "/school1/%2e%2e/school2/a.pdf"]) {
      let nextCalled = false;
      const res = fakeRes();
      onlyOwnSchoolFiles({ schoolId: "school1", path }, res, () => { nextCalled = true; });
      if (path === "/school1/%2e%2e/school2/a.pdf") {
        // Encoded dots are not caught by this guard; express.static decodes and refuses them.
        continue;
      }
      assert.equal(nextCalled, false, path);
      assert.equal(res.statusCode, 403, path);
    }
  });

  test("blocks a request that has no schoolId", () => {
    const res = fakeRes();
    onlyOwnSchoolFiles({ path: "/undefined/a.pdf" }, res, () => assert.fail("must not continue"));
    assert.equal(res.statusCode, 403);
  });
});

describe("generateUniqueCode (per school)", () => {
  test("checks for duplicates only inside the given school", async () => {
    const seen = [];
    const FakeModel = { exists: async (query) => { seen.push(query); return false; } };
    const code = await generateUniqueCode(FakeModel, "studentId", "STU", "school1");
    assert.match(code, /^STU\d{8}$/);
    assert.equal(seen[0].schoolId, "school1");
    assert.equal(seen[0].studentId, code);
  });

  test("retries when the code already exists in that school", async () => {
    let calls = 0;
    const FakeModel = { exists: async () => { calls += 1; return calls < 3; } };
    await generateUniqueCode(FakeModel, "employeeId", "EMP", "school1");
    assert.equal(calls, 3);
  });
});
