const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Class = require("../models/Class");
const User = require("../models/User");

// Formats a populated {user} doc down to the shape the frontend needs for
// a contact picker / conversation header.
const toContact = (userDoc) => ({
  userId: userDoc._id,
  firstName: userDoc.firstName,
  lastName: userDoc.lastName,
  role: userDoc.role,
  profileImage: userDoc.profileImage,
});

const dedupeById = (contacts) => {
  const map = new Map();
  contacts.forEach((c) => map.set(c.userId.toString(), c));
  return [...map.values()];
};

// Enforces the allowed messaging pairs: Student↔Teacher and Admin↔Teacher.
// Returns the list of User
// documents the given user is allowed to start a conversation with.
// Everything is limited to the user's own school (user.schoolId comes from the
// database user loaded by the protect middleware).
const getAllowedContacts = async (user) => {
  const schoolId = user.schoolId;

  if (user.role === "admin") {
    const users = await User.find({ schoolId, role: "teacher", status: "active" });
    return dedupeById(users.map(toContact));
  }

  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ user: user._id, schoolId });
    if (!teacher || teacher.classes.length === 0) return [];

    const students = await Student.find({ schoolId, class: { $in: teacher.classes } }).populate("user");

    const studentContacts = students.map((s) => toContact(s.user));
    const admins = await User.find({ schoolId, role: "admin", status: "active" });

    return dedupeById([...studentContacts, ...admins.map(toContact)]);
  }

  if (user.role === "student") {
    const student = await Student.findOne({ user: user._id, schoolId });
    if (!student?.class) return [];

    const cls = await Class.findOne({ _id: student.class, schoolId }).populate([
      { path: "classTeacher", populate: "user" },
      { path: "subjects.teacher", populate: "user" },
    ]);
    if (!cls) return [];

    const teachers = [
      ...(cls.classTeacher ? [cls.classTeacher] : []),
      ...cls.subjects.map((s) => s.teacher).filter(Boolean),
    ];
    return dedupeById(teachers.map((t) => toContact(t.user)));
  }

  return [];
};

module.exports = { getAllowedContacts };
