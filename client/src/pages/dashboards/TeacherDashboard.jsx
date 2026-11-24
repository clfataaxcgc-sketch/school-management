import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCheckSquare, FiClipboard } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import teacherService from "../../services/teacherService.js";
import assignmentService from "../../services/assignmentService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import ComingSoonCard from "../../components/dashboard/ComingSoonCard.jsx";

// Messages card is built once that module exists (Phase 8).
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [pendingGrading, setPendingGrading] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([teacherService.getMe(), assignmentService.list()])
      .then(([profileRes, assignmentsRes]) => {
        setProfile(profileRes.teacher);
        const pending = assignmentsRes.assignments.reduce(
          (sum, a) => sum + a.submissionStats.submitted + a.submissionStats.late,
          0
        );
        setPendingGrading(pending);
      })
      .catch((err) => toast.error(err.message || "Failed to load your profile"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Welcome, {user?.firstName}</h1>
        <p className="opacity-70">Teacher Dashboard</p>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">My Classes</h2>
          {profile?.classes?.length ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.classes.map((c) => (
                <span key={c._id} className="badge badge-outline">
                  {c.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-50">Not yet assigned to any class.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/teacher/attendance" className="card bg-primary text-primary-content shadow hover:shadow-md transition-shadow">
          <div className="card-body flex-row items-center justify-between">
            <div>
              <h2 className="card-title text-base">
                <FiCheckSquare /> Take Attendance
              </h2>
              <p className="text-xs opacity-90">Mark today's attendance</p>
            </div>
          </div>
        </Link>

        <Link to="/teacher/assignments" className="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div className="card-body flex-row items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-60">Awaiting Grading</p>
              <p className="text-2xl font-bold">{pendingGrading}</p>
            </div>
            <FiClipboard size={22} className="opacity-40" />
          </div>
        </Link>
      </div>

      <ComingSoonCard title="Messages" description="Messages from students will appear here." />
    </div>
  );
}
