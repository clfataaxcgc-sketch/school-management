// Static audit (needs NO database): reads the source code and checks that
// every database query on school data includes a schoolId filter.
// It cannot replace the integration tests, but it catches the most common
// mistake - forgetting `schoolId` in a new query - on every `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const listFiles = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js"));

// Models that hold school data. School itself is not here on purpose.
const TENANT_MODELS = [
  "User", "Student", "Teacher", "Class", "Subject", "Attendance",
  "Assignment", "Submission", "Grade", "Conversation", "Message", "Notification", "Model",
];
const QUERY_METHODS = [
  "find", "findOne", "countDocuments", "updateMany", "updateOne", "deleteMany", "deleteOne",
  "aggregate", "findOneAndUpdate", "findOneAndDelete", "exists", "distinct", "create",
];
const BANNED_METHODS = ["findById", "findByIdAndUpdate", "findByIdAndDelete", "findByIdAndRemove"];

// Files that must follow the rule. Controllers that work across schools by
// design (login, school registration, platform owner) are checked separately.
const FILES_TO_AUDIT = [
  ...listFiles("controllers")
    .filter((f) => !["authController.js", "schoolController.js", "platformController.js"].includes(f))
    .map((f) => `controllers/${f}`),
  "utils/messagingContacts.js",
  "utils/teachingAssignment.js",
  "utils/generateCredentials.js",
  "utils/notifications.js",
];

// Returns the text between the parentheses that start at `openIndex`.
const getCallArguments = (source, openIndex) => {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "(") depth++;
    if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return source.slice(openIndex + 1);
};

// If a query uses a variable (e.g. Student.find(studentFilter)), look at where
// the variable is defined and check schoolId is there.
// We use the NEAREST definition written before the query, because the same
// variable name (like `filter`) is used in many functions of one file.
const resolveVariable = (source, name, beforeIndex) => {
  const regex = new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*`, "g");
  let found = null;
  let match;
  while ((match = regex.exec(source)) !== null && match.index < beforeIndex) found = match;
  if (!found) return "";
  return source.slice(found.index, found.index + 400);
};

const findProblems = (file) => {
  const source = read(file);
  const problems = [];
  const callRegex = new RegExp(`\\b(${TENANT_MODELS.join("|")})\\.(\\w+)\\(`, "g");

  let match;
  while ((match = callRegex.exec(source)) !== null) {
    const [, model, method] = match;
    const line = source.slice(0, match.index).split("\n").length;
    const args = getCallArguments(source, match.index + match[0].length - 1).trim();

    if (BANNED_METHODS.includes(method)) {
      // Only allowed: removing the User we created a moment ago after a failed signup.
      if (!(method === "findByIdAndDelete" && args === "user._id")) {
        problems.push(`${file}:${line} ${model}.${method}() cannot filter by schoolId - use findOne({ _id, schoolId })`);
      }
      continue;
    }
    if (!QUERY_METHODS.includes(method)) continue;

    // Global e-mail uniqueness check: e-mails are unique across all schools on purpose.
    if (model === "User" && method === "findOne" && /^\{\s*email:/.test(args)) continue;

    let textToCheck = args;
    if (/^[A-Za-z_]\w*$/.test(args)) textToCheck = resolveVariable(source, args, match.index);
    // aggregate([{ $match: someVariable }, ...]) - look at the variable too
    const matchVariable = /\$match:\s*([A-Za-z_]\w*)\s*[,}]/.exec(args);
    if (matchVariable) textToCheck += resolveVariable(source, matchVariable[1], match.index);

    if (!/schoolId/.test(textToCheck)) {
      problems.push(`${file}:${line} ${model}.${method}(${args.slice(0, 60).replace(/\s+/g, " ")}) has no schoolId`);
    }
  }

  // `new Grade({...})` creates a document too
  const newRegex = new RegExp(`new\\s+(${TENANT_MODELS.join("|")})\\(`, "g");
  while ((match = newRegex.exec(source)) !== null) {
    const line = source.slice(0, match.index).split("\n").length;
    const args = getCallArguments(source, match.index + match[0].length - 1);
    if (!/schoolId/.test(args)) problems.push(`${file}:${line} new ${match[1]}() has no schoolId`);
  }
  return problems;
};

describe("tenant isolation (static audit)", () => {
  for (const file of FILES_TO_AUDIT) {
    test(`${file}: every school query is filtered by schoolId`, () => {
      assert.deepEqual(findProblems(file), []);
    });
  }

  test("controllers never read schoolId from the request body, query or params", () => {
    const offenders = [];
    for (const file of listFiles("controllers")) {
      const source = read(`controllers/${file}`);
      if (/req\.(body|query|params)\.schoolId/.test(source) || /\{[^}]*\bschoolId\b[^}]*\}\s*=\s*req\.(body|query|params)/.test(source)) {
        offenders.push(file);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("every model except School and the platform-owner User requires schoolId", () => {
    for (const file of fs.readdirSync(path.join(ROOT, "models")).filter((f) => f.endsWith(".js"))) {
      if (file === "School.js") continue;
      const source = read(`models/${file}`);
      assert.match(source, /schoolId/, `${file} has no schoolId`);
      assert.match(source, /schoolId[\s\S]{0,200}required/, `${file}: schoolId is not required`);
    }
  });

  test("school routes are protected (no route file forgets the protect middleware)", () => {
    const publicOnes = ["index.js", "authRoutes.js", "schoolRoutes.js"]; // checked below
    for (const file of listFiles("routes")) {
      if (publicOnes.includes(file)) continue;
      assert.match(read(`routes/${file}`), /protect/, `${file} does not use protect`);
    }
    // schoolRoutes: only /register is public
    const schoolRoutes = read("routes/schoolRoutes.js");
    assert.match(schoolRoutes, /router\.get\("\/me", protect/);
    assert.match(schoolRoutes, /router\.put\("\/me", protect, authorize\("admin"\)/);
  });

  test("platform routes use the platform-owner guard", () => {
    const source = read("routes/platformRoutes.js");
    assert.match(source, /router\.use\(protectPlatformOwner/);
  });

  test("uploaded files are only served to logged-in users of the same school", () => {
    const server = read("server.js");
    assert.match(server, /app\.use\(\s*"\/uploads",\s*protect,\s*onlyOwnSchoolFiles/);
    const upload = read("middleware/upload.js");
    assert.match(upload, /String\(req\.schoolId\)/);
  });

  test("sockets check the user and the school before connecting", () => {
    const source = read("utils/socket.js");
    assert.match(source, /School\.findById/);
    assert.match(source, /school\.status !== "active"/);
    assert.doesNotMatch(source, /io\.emit\(/, "presence must not be broadcast to every school");
  });
  test("the Parent Portal is fully removed from the server and the client", () => {
    // Files that must be gone
    for (const file of ["models/Parent.js", "controllers/parentController.js", "routes/parentRoutes.js"]) {
      assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} should be deleted`);
    }
    for (const file of [
      "../client/src/pages/parent",
      "../client/src/pages/dashboards/ParentDashboard.jsx",
      "../client/src/pages/admin/ParentsManagement.jsx",
      "../client/src/services/parentService.js",
    ]) {
      assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} should be deleted`);
    }

    // No source file may mention parents, except these on purpose:
    //   utils/roles.js           - explains why old "parent" accounts are refused
    //   utils/removeParentData.js - one-time clean-up of old data
    const allowed = ["utils/roles.js", "utils/removeParentData.js"];
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.name === "node_modules" || entry.name === "uploads") return [];
        return entry.isDirectory() ? walk(full) : [full];
      });
    const offenders = [];
    const folders = [
      [ROOT, (f) => f.endsWith(".js") && !f.includes(`${path.sep}tests${path.sep}`)],
      [path.join(ROOT, "..", "client", "src"), (f) => f.endsWith(".js") || f.endsWith(".jsx")],
    ];
    for (const [folder, accept] of folders) {
      for (const file of walk(folder).filter(accept)) {
        const relative = path.relative(ROOT, file).split(path.sep).join("/");
        if (allowed.includes(relative)) continue;
        if (/parent/i.test(fs.readFileSync(file, "utf8"))) offenders.push(relative);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
