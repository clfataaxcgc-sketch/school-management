import { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiSettings, FiX } from "react-icons/fi";
import classService from "../../services/classService.js";
import teacherService from "../../services/teacherService.js";
import subjectService from "../../services/subjectService.js";
import studentService from "../../services/studentService.js";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";

export default function ClassesManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [manageTarget, setManageTarget] = useState(null); // classId being managed (subjects/roster)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classService.list({ search: search || undefined });
      setClasses(res.classes);
    } catch (err) {
      toast.error(err.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await classService.remove(deleteTarget._id);
      toast.success("Class deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to delete class");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="opacity-70 text-sm">{classes.length} total</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingClass(null);
            setFormOpen(true);
          }}
        >
          <FiPlus /> Add Class
        </button>
      </div>

      <label className="input input-bordered input-sm flex items-center gap-2 w-full sm:w-64 mb-4">
        <FiSearch className="opacity-50" />
        <input className="grow" placeholder="Search class name..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {loading ? (
            <LoadingSpinner />
          ) : classes.length === 0 ? (
            <p className="text-sm opacity-50 py-10 text-center">No classes found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class Teacher</th>
                    <th>Students</th>
                    <th>Subjects</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c._id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="opacity-70 text-sm">
                        {c.classTeacher ? `${c.classTeacher.user?.firstName} ${c.classTeacher.user?.lastName}` : "—"}
                      </td>
                      <td>{c.studentCount}</td>
                      <td>{c.subjectCount}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-ghost btn-xs" onClick={() => setManageTarget(c._id)}>
                            <FiSettings /> Manage
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingClass(c);
                              setFormOpen(true);
                            }}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(c)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ClassFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        cls={editingClass}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <ManageClassModal
        classId={manageTarget}
        onClose={() => setManageTarget(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete class?"
        message={`This deletes "${deleteTarget?.name}" and unassigns its students and teachers. Students and teachers themselves are not deleted.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function ClassFormModal({ open, onClose, cls, onSaved }) {
  const isEdit = !!cls;
  const [serverError, setServerError] = useState("");
  const [teacherOptions, setTeacherOptions] = useState([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    setServerError("");
    reset(
      isEdit
        ? { name: cls.name, academicYear: cls.academicYear, classTeacherId: cls.classTeacher?._id || "" }
        : {}
    );
    teacherService
      .list({ limit: 100 })
      .then((res) => setTeacherOptions(res.teachers))
      .catch(() => {});
  }, [open, isEdit, cls, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      const payload = {
        name: data.name,
        academicYear: data.academicYear || undefined,
        classTeacherId: data.classTeacherId || null,
      };
      if (isEdit) {
        await classService.update(cls._id, payload);
        toast.success("Class updated");
      } else {
        await classService.create(payload);
        toast.success("Class created");
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Class" : "Add Class"}>
      <Alert message={serverError} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
        <div className="form-control">
          <label className="label"><span className="label-text">Class Name</span></label>
          <input className="input input-bordered input-sm w-full" placeholder="e.g. Grade 10A" {...register("name", { required: true })} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Academic Year</span></label>
          <input className="input input-bordered input-sm w-full" placeholder="e.g. 2026-2027" {...register("academicYear")} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Class Teacher</span></label>
          <select className="select select-bordered select-sm w-full" {...register("classTeacherId")}>
            <option value="">— None —</option>
            {teacherOptions.map((t) => (
              <option key={t._id} value={t._id}>
                {t.user?.firstName} {t.user?.lastName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isEdit ? "Save Changes" : "Create Class"}
        </button>
      </form>
    </Modal>
  );
}

// Wide modal for assigning subject↔teacher pairs and the student roster for
// one class. Loads its own data by classId so it stays decoupled from the
// list's cached (lighter) class objects.
function ManageClassModal({ classId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [rosterIds, setRosterIds] = useState([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);

  const { control, register, handleSubmit, reset } = useForm({ defaultValues: { subjects: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: "subjects" });

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    Promise.all([
      classService.get(classId),
      subjectService.list(),
      teacherService.list({ limit: 100 }),
      studentService.list({ limit: 200 }),
    ])
      .then(([classRes, subjectRes, teacherRes, studentRes]) => {
        setClassData(classRes.class);
        setStudents(classRes.students);
        setSubjectOptions(subjectRes.subjects);
        setTeacherOptions(teacherRes.teachers);
        setAllStudents(studentRes.students);
        setRosterIds(classRes.students.map((s) => s._id));
        reset({
          subjects: classRes.class.subjects.map((s) => ({
            subjectId: s.subject?._id,
            teacherId: s.teacher?._id || "",
          })),
        });
      })
      .catch((err) => toast.error(err.message || "Failed to load class"))
      .finally(() => setLoading(false));
  }, [classId, reset]);

  if (!classId) return null;

  const saveSubjects = async (data) => {
    setSavingSubjects(true);
    try {
      const subjects = data.subjects
        .filter((s) => s.subjectId)
        .map((s) => ({ subjectId: s.subjectId, teacherId: s.teacherId || null }));
      const res = await classService.updateSubjects(classId, subjects);
      setClassData(res.class);
      toast.success("Subject assignments saved");
      onSaved();
    } catch (err) {
      toast.error(err.message || "Failed to save subjects");
    } finally {
      setSavingSubjects(false);
    }
  };

  const toggleStudent = (id) => {
    setRosterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveRoster = async () => {
    setSavingRoster(true);
    try {
      const res = await classService.updateStudents(classId, rosterIds);
      setStudents(res.students);
      toast.success("Roster saved");
      onSaved();
    } catch (err) {
      toast.error(err.message || "Failed to save roster");
    } finally {
      setSavingRoster(false);
    }
  };

  return (
    <Modal open={!!classId} onClose={onClose} title={classData ? `Manage: ${classData.name}` : "Manage Class"} widthClass="max-w-3xl">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-8">
          {/* Subject / teacher assignment */}
          <section>
            <h4 className="font-semibold mb-2">Subjects & Teachers</h4>
            <form onSubmit={handleSubmit(saveSubjects)} className="space-y-2">
              {fields.length === 0 && <p className="text-sm opacity-50">No subjects assigned yet.</p>}
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <select
                    className="select select-bordered select-sm flex-1"
                    {...register(`subjects.${index}.subjectId`, { required: true })}
                  >
                    <option value="">Select subject...</option>
                    {subjectOptions.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <select className="select select-bordered select-sm flex-1" {...register(`subjects.${index}.teacherId`)}>
                    <option value="">Unassigned</option>
                    {teacherOptions.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.user?.firstName} {t.user?.lastName}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => remove(index)}>
                    <FiX />
                  </button>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => append({ subjectId: "", teacherId: "" })}
                >
                  <FiPlus /> Add subject
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingSubjects}>
                  {savingSubjects ? <span className="loading loading-spinner loading-xs"></span> : "Save Subjects"}
                </button>
              </div>
            </form>
          </section>

          <div className="divider my-0" />

          {/* Roster */}
          <section>
            <h4 className="font-semibold mb-2">Student Roster ({rosterIds.length})</h4>
            <div className="max-h-56 overflow-y-auto border border-base-300 rounded-box p-2 space-y-1">
              {allStudents.length === 0 ? (
                <p className="text-sm opacity-50 p-2">No students exist yet.</p>
              ) : (
                allStudents.map((s) => (
                  <label key={s._id} className="flex items-center gap-2 text-sm py-1 px-1 hover:bg-base-200 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={rosterIds.includes(s._id)}
                      onChange={() => toggleStudent(s._id)}
                    />
                    <span>
                      {s.user?.firstName} {s.user?.lastName}
                    </span>
                    <span className="opacity-50 text-xs">({s.studentId})</span>
                    {s.class && s.class._id !== classId && (
                      <span className="badge badge-xs badge-warning ml-auto">in {s.class.name}</span>
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn btn-primary btn-sm" onClick={saveRoster} disabled={savingRoster}>
                {savingRoster ? <span className="loading loading-spinner loading-xs"></span> : "Save Roster"}
              </button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
