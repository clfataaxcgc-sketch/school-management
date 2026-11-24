import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import assignmentService from "../../services/assignmentService.js";
import uploadService from "../../services/uploadService.js";
import Modal from "../../components/common/Modal.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import Alert from "../../components/common/Alert.jsx";
import AttachmentPicker from "../../components/assignment/AttachmentPicker.jsx";
import AttachmentList from "../../components/assignment/AttachmentList.jsx";

const STATUS_BADGE = {
  pending: "badge-ghost",
  submitted: "badge-info",
  late: "badge-warning",
  graded: "badge-success",
};

export default function MyAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitTarget, setSubmitTarget] = useState(null);

  const load = () => {
    setLoading(true);
    assignmentService
      .list()
      .then((res) => setAssignments(res.assignments))
      .catch((err) => toast.error(err.message || "Failed to load assignments"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Assignments</h1>

      {assignments.length === 0 ? (
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
                      {a.subject?.name} • Due {new Date(a.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`badge badge-sm capitalize ${STATUS_BADGE[a.myStatus]}`}>{a.myStatus}</span>
                </div>
                {a.description && <p className="text-sm mt-2 opacity-80">{a.description}</p>}
                <AttachmentList attachments={a.attachments} />

                {a.mySubmission?.status === "graded" ? (
                  <div className="mt-3 p-2 bg-base-200 rounded text-sm">
                    <p>
                      Grade: <span className="font-semibold">{a.mySubmission.grade}</span> / {a.maxPoints}
                    </p>
                    {a.mySubmission.feedback && <p className="opacity-70 mt-1">{a.mySubmission.feedback}</p>}
                  </div>
                ) : (
                  <div className="flex justify-end mt-3">
                    <button className="btn btn-primary btn-xs" onClick={() => setSubmitTarget(a)}>
                      {a.mySubmission ? "Resubmit" : "Submit"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SubmitModal
        assignment={submitTarget}
        onClose={() => setSubmitTarget(null)}
        onSubmitted={() => {
          setSubmitTarget(null);
          load();
        }}
      />
    </div>
  );
}

function SubmitModal({ assignment, onClose, onSubmitted }) {
  const [serverError, setServerError] = useState("");
  const [attachments, setAttachments] = useState([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();

  useEffect(() => {
    if (assignment) {
      reset({ textResponse: assignment.mySubmission?.textResponse || "" });
      setAttachments(assignment.mySubmission?.attachments || []);
      setServerError("");
    }
  }, [assignment, reset]);

  if (!assignment) return null;

  const onSubmit = async (data) => {
    setServerError("");
    try {
      await assignmentService.submit(assignment._id, { textResponse: data.textResponse, attachments });
      toast.success("Assignment submitted");
      onSubmitted();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <Modal open={!!assignment} onClose={onClose} title={`Submit: ${assignment.title}`}>
      <Alert message={serverError} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-2">
        <div className="form-control">
          <label className="label"><span className="label-text">Your Response</span></label>
          <textarea className="textarea textarea-bordered w-full" rows={4} {...register("textResponse")} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Attachments</span></label>
          <AttachmentPicker attachments={attachments} onChange={setAttachments} uploadFn={uploadService.uploadSubmissionFiles} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isSubmitting}>
          {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : "Submit"}
        </button>
      </form>
    </Modal>
  );
}
