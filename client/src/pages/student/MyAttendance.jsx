import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import attendanceService from "../../services/attendanceService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import AttendanceSummaryCard from "../../components/attendance/AttendanceSummaryCard.jsx";
import AttendanceHistoryTable from "../../components/attendance/AttendanceHistoryTable.jsx";

export default function MyAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceService
      .getMyAttendance()
      .then((res) => setData(res))
      .catch((err) => toast.error(err.message || "Failed to load attendance"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Attendance</h1>
      <AttendanceSummaryCard percentage={data.percentage} counts={data.counts} />
      <AttendanceHistoryTable history={data.history} />
    </div>
  );
}
