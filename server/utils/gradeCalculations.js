const COMPONENT_KEYS = ["assignment", "quiz", "midterm", "final"];

// Computes the derived numbers from a grade's raw components — never
// stored, always recalculated from the entered scores so there's a single
// source of truth (the scores themselves).
//
// - totalScore / totalMax: sum across every component that has been entered
// - percentage: totalScore/totalMax — the standard weighted overall grade
// - average: mean of each entered component's own percentage (unweighted —
//   differs from `percentage` when components have different maxScores)
// - letter: standard 90/80/70/60 cutoffs applied to `percentage`
const computeGradeSummary = (components = {}) => {
  let totalScore = 0;
  let totalMax = 0;
  let percentSum = 0;
  let enteredCount = 0;

  COMPONENT_KEYS.forEach((key) => {
    const c = components[key];
    if (c && c.score !== null && c.score !== undefined && c.maxScore) {
      totalScore += c.score;
      totalMax += c.maxScore;
      percentSum += (c.score / c.maxScore) * 100;
      enteredCount += 1;
    }
  });

  const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : null;
  const average = enteredCount > 0 ? Math.round((percentSum / enteredCount) * 10) / 10 : null;

  let letter = null;
  if (percentage !== null) {
    if (percentage >= 90) letter = "A";
    else if (percentage >= 80) letter = "B";
    else if (percentage >= 70) letter = "C";
    else if (percentage >= 60) letter = "D";
    else letter = "F";
  }

  return { totalScore, totalMax, percentage, average, letter, enteredCount };
};

module.exports = { computeGradeSummary, COMPONENT_KEYS };
