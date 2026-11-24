import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";
import studentService from "../../services/studentService.js";
import classService from "../../services/classService.js";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";

export default function StudentsManagement() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await studentService.list({
          page,
          search: search || undefined,
          status: statusFilter || undefined,
        });
        setStudents(res.students);
        setPagination(res.pagination);
      } catch (err) {
        toast.error(err.message || "Failed to load students");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 300); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditingStudent(null);
    setFormOpen(true);
  };

  const openEdit = (student) => {
    setEditingStudent(student);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await studentService.remove(deleteTarget._id);
      toast.success("Student deleted");
      setDeleteTarget(null);
      load(pagination.page);
    } catch (err) {
      toast.error(err.message || "Failed to delete student");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="opacity-70 text-sm">{pagination.total} total</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <FiPlus /> Add Student
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <label className="input input-bordered input-sm flex items-center gap-2 w-full sm:w-64">
          <FiSearch className="opacity-50" />
          <input
            className="grow"
            placeholder="Search name, email, student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="select select-bordered select-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {loading ? (
            <LoadingSpinner />
          ) : students.length === 0 ? (
            <p className="text-sm opacity-50 py-10 text-center">No students found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s._id}>
                      <td className="font-mono text-xs">{s.studentId}</td>
                      <td className="font-medium">
                        {s.user?.firstName} {s.user?.lastName}
                      </td>
                      <td className="opacity-70">{s.user?.email}</td>
                      <td className="text-sm opacity-70">{s.class?.name || "—"}</td>
                      <td>
                        <span
                          className={`badge badge-sm capitalize ${
                            s.user?.status === "active" ? "badge-outline" : "badge-error badge-outline"
                          }`}
                        >
                          {s.user?.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(s)}>
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(s)}>
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

      {pagination.pages > 1 && (
        <div className="join mt-4 flex justify-center">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`join-item btn btn-sm ${p === pagination.page ? "btn-active" : ""}`}
              onClick={() => load(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editingStudent}
        onSaved={() => {
          setFormOpen(false);
          load(pagination.page);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete student?"
        message={`This permanently deletes ${deleteTarget?.user?.firstName}'s account and student record. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function StudentFormModal({ open, onClose, student, onSaved }) {
  const isEdit = !!student;
  const [serverError, setServerError] = useState("");
  const [classOptions, setClassOptions] = useState([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    setServerError("");
    reset(
      isEdit
        ? {
            firstName: student.user?.firstName,
            lastName: student.user?.lastName,
            email: student.user?.email,
            phone: student.user?.phone,
            dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "",
            gender: student.gender || "",
            status: student.user?.status,
            classId: student.class?._id || "",
          }
        : {}
    );
    classService
      .list()
      .then((res) => setClassOptions(res.classes))
      .catch(() => {});
  }, [open, isEdit, student, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      if (isEdit) {
        await studentService.update(student._id, {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth || undefined,
          gender: data.gender || undefined,
          status: data.status,
          classId: data.classId || null,
        });
        toast.success("Student updated");
      } else {
        const res = await studentService.create({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth || undefined,
          gender: data.gender || undefined,
          classId: data.classId || undefined,
        });
        if (res.tempPassword) {
          toast.success(`Student created. Temp password: ${res.tempPassword}`, { duration: 8000 });
        } else {
          toast.success("Student created");
        }
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Student" : "Add Student"}>
      <Alert message={serverError} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label"><span className="label-text">First Name</span></label>
            <input className="input input-bordered input-sm w-full" {...register("firstName", { required: true })} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Last Name</span></label>
            <input className="input input-bordered input-sm w-full" {...register("lastName", { required: true })} />
          </div>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Email</span></label>
          <input
            type="email"
            className="input input-bordered input-sm w-full"
            disabled={isEdit}
            {...register("email", { required: !isEdit })}
          />
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Phone</span></label>
          <input className="input input-bordered input-sm w-full" {...register("phone")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label"><span className="label-text">Date of Birth</span></label>
            <input type="date" className="input input-bordered input-sm w-full" {...register("dateOfBirth")} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Gender</span></label>
            <select className="select select-bordered select-sm w-full" {...register("gender")}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Class</span></label>
          <select className="select select-bordered select-sm w-full" {...register("classId")}>
            <option value="">— Unassigned —</option>
            {classOptions.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div className="form-control">
            <label className="label"><span className="label-text">Status</span></label>
            <select className="select select-bordered select-sm w-full" {...register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isEdit ? "Save Changes" : "Create Student"}
        </button>
      </form>
    </Modal>
  );
}
