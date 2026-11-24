const crypto = require("crypto");

// Generates a random temporary password for accounts an admin creates on
// someone else's behalf (students and teachers don't self-register
// in a real deployment). Returned once in the API response so the admin
// can share it; never logged or stored in plaintext.
const generateTempPassword = () => {
  const raw = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `${raw.slice(0, 10)}#1`;
};

// Generates a unique, human-readable code (studentId, employeeId, ...) by
// retrying with a fresh random suffix on the rare collision.
// The code only has to be unique inside one school, so we check with schoolId.
const generateUniqueCode = async (Model, field, prefix, schoolId) => {
  let code;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}${new Date().getFullYear()}${random}`;
    exists = await Model.exists({ schoolId, [field]: code });
    attempts += 1;
  }
  if (exists) throw new Error(`Could not generate a unique ${field} after multiple attempts`);
  return code;
};

module.exports = { generateTempPassword, generateUniqueCode };
