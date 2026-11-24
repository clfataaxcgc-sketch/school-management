import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { FiPlus, FiEdit2, FiTrash2, FiUsers } from "react-icons/fi";
import teacherService from "../../services/teacherService.js";
import classService from "../../services/classService.js";
import assignmentService from "../../services/assignmentService.js";
import uploadService from "../../services/uploadService.js";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";
import AttachmentPicker from "../../components/assignment/AttachmentPicker.jsx";
import AttachmentList from "../../components/assignment/AttachmentList.jsx";

const STATUS_BADGE = { submitted: "badge-info", late: "badge-warning", graded: "badge-success" };

export default function AssignmentsManagement() {
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [classSubjectMap, setClassSubjectMap] = useState({}); // classId -> [{_id,name,code}]
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [gradingAssignment, setGradingAssignment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, assignmentsRes] = await Promise.all([
        teacherService.getMe(),
        assignmentService.list(),
      ]);
      setProfile(profileRes.teacher);
      setAssignments(assignmentsRes.assignments);

      // Build, per class, only the subjects THIS teacher is assigned to
      // teach there — Teacher.classes doesn't carry that detail, so we
      // pull it from each Class document (same approach as TakeAttendance).
      const map = {};
      await Promise.all(
        profileRes.teacher.classes.map(async (c) => {
          const detail = await classService.get(c._id);
          map[c._id] = detail.class.subjects
            .filter((s) => s.teacher?._id === profileRes.teacher._id)
            .map((s) => s.subject);
        })
      );
      setClassSubjectMap(map);
    } catch (err) {
      toast.error(err.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await assignmentService.remove(deleteTarget._id);
      toast.success("Assignment deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to delete assignment");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="opacity-70 text-sm">{assignments.length} total</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingAssignment(null);
            setFormOpen(true);
          }}
          disabled={!profile?.classes?.length}
        >
          <FiPlus /> Add Assignment
        </button>
      </div>

      {!profile?.classes?.length ? (
        <p className="text-sm opacity-60">You're not assigned to any class/subject yet. Ask an admin to assign you.</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm opacity-50 py-10 text-center">No assignments yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {assignments.map((a) => (
            <div key={a._id} className="card bg-base-100 shadow">
              <div className="card-body p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="text-xs opacity-60">
                      {a.class?.name} • {a.subject?.name} • Due {new Date(a.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setEditingAssignment(a);
                        setFormOpen(true);
                      }}
                    >
                      <FiEdit2 />
                    </button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(a)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-3 text-xs opacity-70">
                    <span>Submitted: {a.submissionStats.submitted + a.submissionStats.late}</span>
                    <span>Graded: {a.submissionStats.graded}</span>
                  </div>
                  <button className="btn btn-outline btn-xs" onClick={() => setGradingAssignment(a)}>
                    <FiUsers /> View Submissions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        assignment={editingAssignment}
        classes={profile?.classes || []}
        classSubjectMap={classSubjectMap}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />

      <SubmissionsModal
        assignmentId={gradingAssignment?._id}
        assignmentTitle={gradingAssignment?.title}
        maxPoints={gradingAssignment?.maxPoints}
        onClose={() => setGradingAssignment(null)}
        onGraded={load}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete assignment?"
        message={`This deletes "${deleteTarget?.title}" and all student submissions for it. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function AssignmentFormModal({ open, onClose, assignment, classes, classSubjectMap, onSaved }) {
  const isEdit = !!assignment;
  const [serverError, setServerError] = useState("");
  const [attachments, setAttachments] = useState([]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm();

  const selectedClassId = watch("classId");
  const subjectsForClass = classSubjectMap[selectedClassId] || [];

  useEffect(() => {
    if (!open) return;
    setServerError("");
    setAttachments(isEdit ? assignment.attachments || [] : []);
    reset(
      isEdit
        ? {
            title: assignment.title,
            description: assignment.description,
            classId: assignment.class?._id,
            subjectId: assignment.subject?._id,
            dueDate: assignment.dueDate?.slice(0, 10),
            maxPoints: assignment.maxPoints,
          }
        : { maxPoints: 100 }
    );
  }, [open, isEdit, assignment, reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      if (isEdit) {
        await assignmentService.update(assignment._id, {
          title: data.title,
          description: data.description,
          dueDate: data.dueDate,
          maxPoints: Number(data.maxPoints),
          attachments,
        });
        toast.success("Assignment updated");
      } else {
        await assignmentService.create({
          title: data.title,
          description: data.description,
          classId: data.classId,
          subjectId: data.subjectId,
          dueDate: data.dueDate,
          maxPoints: Number(data.maxPoints),
          attachments,
        });
        toast.success("Assignment created");
      }
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Assignment" : "Add Assignment"}>
      <Alert message={serverError} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
        <div className="form-control">
          <label className="label"><span className="label-text">Title</span></label>
          <input className="input input-bordered input-sm w-full" {...register("title", { required: true })} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea className="textarea textarea-bordered textarea-sm w-full" rows={3} {...register("description")} />
        </div>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text">Class</span></label>
              <select className="select select-bordered select-sm w-full" {...register("classId", { required: true })}>
                <option value="">Select...</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Subject</span></label>
              <select className="select select-bordered select-sm w-full" {...register("subjectId", { required: true })}>
                <option value="">Select...</option>
                {subjectsForClass.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label"><span className="label-text">Due Date</span></label>
            <input type="date" className="input input-bordered input-sm w-full" {...register("dueDate", { required: true })} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Max Points</span></label>
            <input type="number" min={1} className="input input-bordered input-sm w-full" {...register("maxPoints", { required: true })} />
          </div>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Attachments</span></label>
          <AttachmentPicker attachments={attachments} onChange={setAttachments} uploadFn={uploadService.uploadAssignmentFiles} />
        </div>

        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isEdit ? "Save Changes" : "Create Assignment"}
        </button>
      </form>
    </Modal>
  );
}

function SubmissionsModal({ assignmentId, assignmentTitle, maxPoints, onClose, onGraded }) {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [gradingFor, setGradingFor] = useState(null); // submission being graded

  useEffect(() => {
    if (!assignmentId) return;
    setLoading(true);
    assignmentService
      .get(assignmentId)
      .then((res) => setSubmissions(res.submissions))
      .catch((err) => toast.error(err.message || "Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (!assignmentId) return null;

  return (
    <Modal open={!!assignmentId} onClose={onClose} title={`Submissions: ${assignmentTitle}`} widthClass="max-w-2xl">
      {loading ? (
        <LoadingSpinner />
      ) : submissions.length === 0 ? (
        <p className="text-sm opacity-50 py-10 text-center">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s._id} className="border border-base-300 rounded-box p-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {s.student?.user?.firstName} {s.student?.user?.lastName}
                  </p>
                  <p className="text-xs opacity-60">Submitted {new Date(s.submittedAt).toLocaleString()}</p>
                </div>
                <span className={`badge badge-sm capitalize ${STATUS_BADGE[s.status]}`}>{s.status}</span>
              </div>
              {s.textResponse && <p className="text-sm mt-2 whitespace-pre-wrap">{s.textResponse}</p>}
              <AttachmentList attachments={s.attachments} />
              <div className="flex items-center justify-between mt-2">
                {s.status === "graded" ? (
                  <p className="text-sm">
                    Grade: <span className="font-semibold">{s.grade}</span> / {maxPoints}
                    {s.feedback && <span className="opacity-60"> — {s.feedback}</span>}
                  </p>
                ) : (
                  <span />
                )}
                <button className="btn btn-outline btn-xs" onClick={() => setGradingFor(s)}>
                  {s.status === "graded" ? "Edit Grade" : "Grade"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GradeModal
        submission={gradingFor}
        assignmentId={assignmentId}
        maxPoints={maxPoints}
        onClose={() => setGradingFor(null)}
        onGraded={(updated) => {
          setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
          setGradingFor(null);
          onGraded();
        }}
      />
    </Modal>
  );
}

function GradeModal({ submission, assignmentId, maxPoints, onClose, onGraded }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    if (submission) reset({ grade: submission.grade ?? "", feedback: submission.feedback || "" });
  }, [submission, reset]);

  if (!submission) return null;

  const onSubmit = async (data) => {
    try {
      const res = await assignmentService.grade(assignmentId, submission._id, {
        grade: Number(data.grade),
        feedback: data.feedback,
      });
      toast.success("Grade saved");
      onGraded(res.submission);
    } catch (err) {
      toast.error(err.message || "Failed to save grade");
    }
  };

  return (
    <Modal open={!!submission} onClose={onClose} title="Grade Submission" widthClass="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="form-control">
          <label className="label"><span className="label-text">Grade (out of {maxPoints})</span></label>
          <input
            type="number"
            min={0}
            max={maxPoints}
            className="input input-bordered input-sm w-full"
            {...register("grade", { required: true, min: 0, max: maxPoints })}
          />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Feedback</span></label>
          <textarea className="textarea textarea-bordered textarea-sm w-full" rows={3} {...register("feedback")} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Save Grade"}
        </button>
      </form>
    </Modal>
  );
}
