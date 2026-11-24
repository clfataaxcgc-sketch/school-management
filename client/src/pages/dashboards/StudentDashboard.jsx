import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import attendanceService from "../../services/attendanceService.js";
import assignmentService from "../../services/assignmentService.js";
import gradeService from "../../services/gradeService.js";
import ComingSoonCard from "../../components/dashboard/ComingSoonCard.jsx";

// Subjects card is still pending a dedicated "my subjects" view.
// Attendance, Assignments and Grades are real, wired up in Phase 5/6/7.
export default function StudentDashboard() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [averageGrade, setAverageGrade] = useState(null);

  useEffect(() => {
    attendanceService
      .getMyAttendance()
      .then((res) => setAttendance(res))
      .catch(() => {});
    assignmentService
      .list()
      .then((res) => {
        const pending = res.assignments.filter((a) => a.myStatus === "pending" || a.myStatus === "late").length;
        setPendingCount(pending);
      })
      .catch(() => {});
    gradeService
      .getMyGrades()
      .then((res) => {
        const percentages = res.grades.map((g) => g.summary.percentage).filter((p) => p !== null);
        setAverageGrade(
          percentages.length ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10 : null
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Welcome, {user?.firstName}</h1>
        <p className="opacity-70">Student Dashboard</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/student/attendance" className="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-wide opacity-60">Attendance</p>
            <p className="text-2xl font-bold">
              {attendance?.percentage !== null && attendance?.percentage !== undefined
                ? `${attendance.percentage}%`
                : "—"}
            </p>
          </div>
        </Link>
        <Link to="/student/assignments" className="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-wide opacity-60">Assignments</p>
            <p className="text-2xl font-bold">{pendingCount !== null ? `${pendingCount} Pending` : "—"}</p>
          </div>
        </Link>
        <Link to="/student/grades" className="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-wide opacity-60">Average Grade</p>
            <p className="text-2xl font-bold">{averageGrade !== null ? `${averageGrade}%` : "—"}</p>
          </div>
        </Link>
        <ComingSoonCard title="Subjects" description="A dedicated 'my subjects' view is still pending." />
      </div>
    </div>
  );
}
