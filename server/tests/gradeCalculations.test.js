const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { computeGradeSummary } = require("../utils/gradeCalculations");

describe("computeGradeSummary", () => {
  test("returns nulls when no components are entered", () => {
    const result = computeGradeSummary({});
    assert.equal(result.percentage, null);
    assert.equal(result.average, null);
    assert.equal(result.letter, null);
    assert.equal(result.enteredCount, 0);
  });

  test("computes weighted percentage across mixed maxScores", () => {
    // 18/20 + 85/100 = 103/120 = 85.83% (weighted), letter B
    const result = computeGradeSummary({
      assignment: { score: 18, maxScore: 20 },
      midterm: { score: 85, maxScore: 100 },
    });
    assert.equal(result.totalScore, 103);
    assert.equal(result.totalMax, 120);
    assert.equal(result.percentage, 85.8);
    assert.equal(result.letter, "B");
    assert.equal(result.enteredCount, 2);
  });

  test("average is the unweighted mean of component percentages", () => {
    // 10/20 = 50%, 90/100 = 90% -> average = 70%, but weighted percentage
    // = 100/120 = 83.3% — these should differ, proving they're computed
    // independently rather than one derived from the other.
    const result = computeGradeSummary({
      assignment: { score: 10, maxScore: 20 },
      final: { score: 90, maxScore: 100 },
    });
    assert.equal(result.average, 70);
    assert.notEqual(result.average, result.percentage);
  });

  test("ignores components with a null score", () => {
    const result = computeGradeSummary({
      assignment: { score: null, maxScore: 20 },
      quiz: { score: 15, maxScore: 20 },
    });
    assert.equal(result.enteredCount, 1);
    assert.equal(result.percentage, 75);
  });

  [
    [95, "A"],
    [90, "A"],
    [89, "B"],
    [80, "B"],
    [79, "C"],
    [70, "C"],
    [69, "D"],
    [60, "D"],
    [59, "F"],
    [0, "F"],
  ].forEach(([score, expectedLetter]) => {
    test(`${score}% maps to letter ${expectedLetter}`, () => {
      const result = computeGradeSummary({ final: { score, maxScore: 100 } });
      assert.equal(result.letter, expectedLetter);
    });
  });
});
