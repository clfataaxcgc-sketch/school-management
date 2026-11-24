import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";
import teacherService from "../../services/teacherService.js";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";

export default function TeachersManagement() {
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await teacherService.list({
          page,
          search: search || undefined,
          status: statusFilter || undefined,
        });
        setTeachers(res.teachers);
        setPagination(res.pagination);
      } catch (err) {
        toast.error(err.message || "Failed to load teachers");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await teacherService.remove(deleteTarget._id);
      toast.success("Teacher deleted");
      setDeleteTarget(null);
      load(pagination.page);
    } catch (err) {
      toast.error(err.message || "Failed to delete teacher");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="opacity-70 text-sm">{pagination.total} total</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingTeacher(null);
            setFormOpen(true);
          }}
        >
          <FiPlus /> Add Teacher
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <label className="input input-bordered input-sm flex items-center gap-2 w-full sm:w-64">
          <FiSearch className="opacity-50" />
          <input
            className="grow"
            placeholder="Search name, email, employee ID..."
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
          ) : teachers.length === 0 ? (
            <p className="text-sm opacity-50 py-10 text-center">No teachers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Classes</th>
                    <th>Subjects</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t._id}>
                      <td className="font-mono text-xs">{t.employeeId}</td>
                      <td className="font-medium">
                        {t.user?.firstName} {t.user?.lastName}
                      </td>
                      <td className="opacity-70">{t.user?.email}</td>
                      <td className="text-xs opacity-70">
                        {t.classes?.length ? t.classes.map((c) => c.name).join(", ") : "—"}
                      </td>
                      <td className="text-xs opacity-70">
                        {t.subjects?.length ? t.subjects.map((s) => s.code).join(", ") : "—"}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm capitalize ${
                            t.user?.status === "active" ? "badge-outline" : "badge-error badge-outline"
                          }`}
                        >
                          {t.user?.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingTeacher(t);
                              setFormOpen(true);
                            }}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(t)}>
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

      <TeacherFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teacher={editingTeacher}
        onSaved={() => {
          setFormOpen(false);
          load(pagination.page);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete teacher?"
        message={`This permanently deletes ${deleteTarget?.user?.firstName}'s account and teacher record. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function TeacherFormModal({ open, onClose, teacher, onSaved }) {
  const isEdit = !!teacher;
  const [serverError, setServerError] = useState("");
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
        ? {
            firstName: teacher.user?.firstName,
            lastName: teacher.user?.lastName,
            email: teacher.user?.email,
            phone: teacher.user?.phone,
            status: teacher.user?.status,
          }
        : {}
    );
  }, [open, isEdit, teacher, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      if (isEdit) {
        await teacherService.update(teacher._id, {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          status: data.status,
        });
        toast.success("Teacher updated");
      } else {
        const res = await teacherService.create({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
        });
        if (res.tempPassword) {
          toast.success(`Teacher created. Temp password: ${res.tempPassword}`, { duration: 8000 });
        } else {
          toast.success("Teacher created");
        }
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Teacher" : "Add Teacher"}>
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

        {!isEdit && (
          <p className="text-xs opacity-60">
            Subjects and classes are assigned from the Classes page ("Manage" on a class), not here.
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isEdit ? "Save Changes" : "Create Teacher"}
        </button>
      </form>
    </Modal>
  );
}
