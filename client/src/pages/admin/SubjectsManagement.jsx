import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";
import subjectService from "../../services/subjectService.js";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";

export default function SubjectsManagement() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subjectService.list({ search: search || undefined });
      setSubjects(res.subjects);
    } catch (err) {
      toast.error(err.message || "Failed to load subjects");
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
      await subjectService.remove(deleteTarget._id);
      toast.success("Subject deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to delete subject");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subjects</h1>
          <p className="opacity-70 text-sm">{subjects.length} total</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingSubject(null);
            setFormOpen(true);
          }}
        >
          <FiPlus /> Add Subject
        </button>
      </div>

      <label className="input input-bordered input-sm flex items-center gap-2 w-full sm:w-64 mb-4">
        <FiSearch className="opacity-50" />
        <input
          className="grow"
          placeholder="Search name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {loading ? (
            <LoadingSpinner />
          ) : subjects.length === 0 ? (
            <p className="text-sm opacity-50 py-10 text-center">No subjects found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s._id}>
                      <td className="font-mono text-xs">{s.code}</td>
                      <td className="font-medium">{s.name}</td>
                      <td className="opacity-70 text-sm">{s.description || "—"}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingSubject(s);
                              setFormOpen(true);
                            }}
                          >
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

      <SubjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        subject={editingSubject}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete subject?"
        message={`This removes "${deleteTarget?.name}" and unassigns it from any classes/teachers. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function SubjectFormModal({ open, onClose, subject, onSaved }) {
  const isEdit = !!subject;
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
    reset(isEdit ? { name: subject.name, code: subject.code, description: subject.description } : {});
  }, [open, isEdit, subject, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      if (isEdit) {
        await subjectService.update(subject._id, data);
        toast.success("Subject updated");
      } else {
        await subjectService.create(data);
        toast.success("Subject created");
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Subject" : "Add Subject"}>
      <Alert message={serverError} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
        <div className="form-control">
          <label className="label"><span className="label-text">Name</span></label>
          <input className="input input-bordered input-sm w-full" {...register("name", { required: true })} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Code</span></label>
          <input
            className="input input-bordered input-sm w-full uppercase"
            placeholder="e.g. MATH101"
            {...register("code", { required: true })}
          />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} {...register("description")} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isEdit ? "Save Changes" : "Create Subject"}
        </button>
      </form>
    </Modal>
  );
}
