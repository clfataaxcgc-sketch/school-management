const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApiError = require("../utils/ApiError");

describe("ApiError", () => {
  test("carries statusCode, message and errors", () => {
    const err = new ApiError(404, "Not found", ["detail"]);
    assert.equal(err.statusCode, 404);
    assert.equal(err.message, "Not found");
    assert.deepEqual(err.errors, ["detail"]);
    assert.equal(err.success, false);
    assert.ok(err instanceof Error);
  });

  test("defaults errors to an empty array", () => {
    const err = new ApiError(400, "Bad request");
    assert.deepEqual(err.errors, []);
  });
});
