// The roles this application supports. Any other role found in the database
// (for example an old "parent" account from before the Parent Portal was
// removed) is refused at login and by the protect middleware.
const SCHOOL_ROLES = ["admin", "teacher", "student"];
const ALL_ROLES = [...SCHOOL_ROLES, "platform_owner"];

module.exports = { SCHOOL_ROLES, ALL_ROLES };
