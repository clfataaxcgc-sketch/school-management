import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import reportService, { triggerDownload } from "../../services/reportService.js";
import classService from "../../services/classService.js";
import subjectService from "../../services/subjectService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";

const LETTER_COLORS = { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" };

export default function Reports() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [comparison, setComparison] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(true);

  const [distribution, setDistribution] = useState(null);
  const [distClassId, setDistClassId] = useState("");
  const [distSubjectId, setDistSubjectId] = useState("");

  const [trendClassId, setTrendClassId] = useState("");
  const [trendSubjectId, setTrendSubjectId] = useState("");
  const [trend, setTrend] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([classService.list(), subjectService.list()])
      .then(([classRes, subjectRes]) => {
        setClasses(classRes.classes);
        setSubjects(subjectRes.subjects);
      })
      .catch((err) => toast.error(err.message || "Failed to load filters"))
      .finally(() => setLoadingOptions(false));

    reportService
      .getClassComparison()
      .then((res) => setComparison(res.rows))
      .catch((err) => toast.error(err.message || "Failed to load class comparison"))
      .finally(() => setLoadingComparison(false));
  }, []);

  useEffect(() => {
    reportService
      .getGradeDistribution({ classId: distClassId || undefined, subjectId: distSubjectId || undefined })
      .then((res) => setDistribution(res.distribution))
      .catch(() => {});
  }, [distClassId, distSubjectId]);

  useEffect(() => {
    if (!trendClassId) {
      setTrend([]);
      return;
    }
    setLoadingTrend(true);
    reportService
      .getAttendanceTrend(trendClassId, { subjectId: trendSubjectId || undefined })
      .then((res) => setTrend(res.series))
      .catch((err) => toast.error(err.message || "Failed to load attendance trend"))
      .finally(() => setLoadingTrend(false));
  }, [trendClassId, trendSubjectId]);

  const distributionData = distribution
    ? Object.entries(distribution)
        .map(([letter, count]) => ({ letter, count }))
        .filter((d) => d.count > 0)
    : [];

  const handleExportAttendance = async () => {
    if (!trendClassId) return toast.error("Pick a class first");
    setExporting(true);
    try {
      const blob = await reportService.downloadAttendanceCsv(trendClassId, { subjectId: trendSubjectId || undefined });
      triggerDownload(blob, "attendance-report.csv");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportGrades = async () => {
    if (!distClassId || !distSubjectId) return toast.error("Pick a class and subject first");
    setExporting(true);
    try {
      const blob = await reportService.downloadGradesCsv(distClassId, distSubjectId);
      triggerDownload(blob, "grades-report.csv");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loadingOptions) return <LoadingSpinner fullScreen />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      {/* Class comparison */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Class Comparison</h2>
          <p className="text-xs opacity-60 -mt-1 mb-2">Attendance (30d) vs. average grade, by class</p>
          {loadingComparison ? (
            <LoadingSpinner />
          ) : comparison.length === 0 ? (
            <p className="text-sm opacity-50 py-6 text-center">No classes yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="attendancePercentage" name="Attendance %" fill="#3b82f6" />
                  <Bar dataKey="averageGrade" name="Average Grade %" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance trend */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-base">Attendance Trend</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="select select-bordered select-sm w-full"
                value={trendClassId}
                onChange={(e) => setTrendClassId(e.target.value)}
              >
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm w-full"
                value={trendSubjectId}
                onChange={(e) => setTrendSubjectId(e.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {loadingTrend ? (
              <LoadingSpinner />
            ) : !trendClassId ? (
              <p className="text-sm opacity-50 py-10 text-center">Select a class to see its trend.</p>
            ) : (
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
            )}
            <button className="btn btn-outline btn-xs mt-2 w-fit" onClick={handleExportAttendance} disabled={exporting}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Grade distribution */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-base">Grade Distribution</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="select select-bordered select-sm w-full"
                value={distClassId}
                onChange={(e) => setDistClassId(e.target.value)}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm w-full"
                value={distSubjectId}
                onChange={(e) => setDistSubjectId(e.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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
              disabled={exporting || !distClassId || !distSubjectId}
            >
              Export CSV {(!distClassId || !distSubjectId) && "(pick class + subject)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
