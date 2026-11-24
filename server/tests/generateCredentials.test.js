const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { generateTempPassword, generateUniqueCode } = require("../utils/generateCredentials");

describe("generateTempPassword", () => {
  test("produces a non-trivial random string each time", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    assert.notEqual(a, b);
    assert.ok(a.length >= 10);
  });
});

describe("generateUniqueCode", () => {
  test("returns a code with the given prefix and current year", () => {
    // Fake model: nothing exists, so the first random code is accepted.
    const FakeModel = { exists: async () => false };
    return generateUniqueCode(FakeModel, "studentId", "STU").then((code) => {
      const year = new Date().getFullYear();
      assert.match(code, new RegExp(`^STU${year}\\d{4}$`));
    });
  });

  test("retries when a collision is reported, then succeeds", async () => {
    let calls = 0;
    // Fake model: first two calls report a collision, third call is free.
    const FakeModel = {
      exists: async () => {
        calls += 1;
        return calls <= 2;
      },
    };
    const code = await generateUniqueCode(FakeModel, "employeeId", "EMP");
    assert.equal(calls, 3);
    assert.match(code, /^EMP\d{4}\d{4}$/);
  });

  test("throws after repeated collisions instead of looping forever", async () => {
    const FakeModel = { exists: async () => true };
    await assert.rejects(
      () => generateUniqueCode(FakeModel, "studentId", "STU"),
      /Could not generate a unique studentId/
    );
  });
});
