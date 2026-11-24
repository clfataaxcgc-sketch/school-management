import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import teacherService from "../../services/teacherService.js";
import classService from "../../services/classService.js";
import reportService, { triggerDownload } from "../../services/reportService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";

const LETTER_COLORS = { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" };

export default function Reports() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [classSubjectMap, setClassSubjectMap] = useState({});

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [trend, setTrend] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    teacherService
      .getMe()
      .then(async (res) => {
        setProfile(res.teacher);
        const map = {};
        await Promise.all(
          res.teacher.classes.map(async (c) => {
            const detail = await classService.get(c._id);
            map[c._id] = detail.class.subjects
              .filter((s) => s.teacher?._id === res.teacher._id)
              .map((s) => s.subject);
          })
        );
        setClassSubjectMap(map);
      })
      .catch((err) => toast.error(err.message || "Failed to load your teacher profile"))
      .finally(() => setLoadingProfile(false));
  }, []);

  const availableSubjects = useMemo(() => classSubjectMap[classId] || [], [classSubjectMap, classId]);

  useEffect(() => {
    if (!classId) {
      setTrend([]);
      setDistribution(null);
      return;
    }
    setLoadingData(true);
    Promise.all([
      reportService.getAttendanceTrend(classId, { subjectId: subjectId || undefined }),
      reportService.getGradeDistribution({ classId, subjectId: subjectId || undefined }),
    ])
      .then(([trendRes, distRes]) => {
        setTrend(trendRes.series);
        setDistribution(distRes.distribution);
      })
      .catch((err) => toast.error(err.message || "Failed to load reports"))
      .finally(() => setLoadingData(false));
  }, [classId, subjectId]);

  const distributionData = distribution
    ? Object.entries(distribution)
        .map(([letter, count]) => ({ letter, count }))
        .filter((d) => d.count > 0)
    : [];

  const handleExportAttendance = async () => {
    setExporting(true);
    try {
      const blob = await reportService.downloadAttendanceCsv(classId, { subjectId: subjectId || undefined });
      triggerDownload(blob, "attendance-report.csv");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportGrades = async () => {
    if (!subjectId) return toast.error("Pick a subject first");
    setExporting(true);
    try {
      const blob = await reportService.downloadGradesCsv(classId, subjectId);
      triggerDownload(blob, "grades-report.csv");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loadingProfile) return <LoadingSpinner fullScreen />;

  if (!profile?.classes?.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Reports</h1>
        <p className="opacity-60 text-sm">You're not currently assigned to any class.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text">Class</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSubjectId("");
                }}
              >
                <option value="">Select class...</option>
                {profile.classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Subject</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={!classId}
              >
                <option value="">All subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {!classId ? (
        <p className="text-sm opacity-50 py-10 text-center">Select a class to see reports.</p>
      ) : loadingData ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Attendance Trend</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="percentage" name="Attendance %" stroke="#3b82f6" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <button className="btn btn-outline btn-xs mt-2 w-fit" onClick={handleExportAttendance} disabled={exporting}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Grade Distribution</h2>
              {distributionData.length === 0 ? (
                <p className="text-sm opacity-50 py-10 text-center">No grades entered yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        dataKey="count"
                        nameKey="letter"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.letter}: ${entry.count}`}
                      >
                        {distributionData.map((d) => (
                          <Cell key={d.letter} fill={LETTER_COLORS[d.letter]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <button
                className="btn btn-outline btn-xs mt-2 w-fit"
                onClick={handleExportGrades}
                disabled={exporting || !subjectId}
              >
                Export CSV {!subjectId && "(pick a subject)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
