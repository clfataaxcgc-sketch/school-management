const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Subject = require("../models/Subject");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");

// @desc    Create a subject
// @route   POST /api/subjects
// @access  Private/Admin
const createSubject = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    throw new ApiError(400, "name and code are required");
  }

  const exists = await Subject.findOne({
    schoolId: req.schoolId,
    $or: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
  });
  if (exists) {
    throw new ApiError(409, "A subject with this name or code already exists");
  }

  const subject = await Subject.create({ schoolId: req.schoolId, name, code, description });
  res.status(201).json({ success: true, subject });
});

// @desc    List subjects (search by name/code)
// @route   GET /api/subjects?search=
// @access  Private/Admin
const getSubjects = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { schoolId: req.schoolId };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  const subjects = await Subject.find(filter).sort({ name: 1 });
  res.status(200).json({ success: true, subjects });
});

// @desc    Get one subject
// @route   GET /api/subjects/:id
// @access  Private/Admin
const getSubjectById = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!subject) throw new ApiError(404, "Subject not found");
  res.status(200).json({ success: true, subject });
});

// @desc    Update a subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
const updateSubject = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  const subject = await Subject.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!subject) throw new ApiError(404, "Subject not found");

  if (name !== undefined) subject.name = name;
  if (code !== undefined) subject.code = code;
  if (description !== undefined) subject.description = description;

  await subject.save();
  res.status(200).json({ success: true, subject });
});

// @desc    Delete a subject (cascades: removes it from every Class.subjects
//          entry and from any Teacher.subjects that referenced it)
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!subject) throw new ApiError(404, "Subject not found");

  await Class.updateMany(
    { schoolId: req.schoolId },
    { $pull: { subjects: { subject: subject._id } } }
  );
  await Teacher.updateMany({ schoolId: req.schoolId }, { $pull: { subjects: subject._id } });
  await subject.deleteOne();

  res.status(200).json({ success: true, message: "Subject deleted" });
});

module.exports = { createSubject, getSubjects, getSubjectById, updateSubject, deleteSubject };
