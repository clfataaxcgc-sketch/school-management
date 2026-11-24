import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import teacherService from "../../services/teacherService.js";
import classService from "../../services/classService.js";
import gradeService from "../../services/gradeService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";

const COMPONENTS = [
  { key: "assignment", label: "Assignment", defaultMax: 20 },
  { key: "quiz", label: "Quiz", defaultMax: 20 },
  { key: "midterm", label: "Midterm", defaultMax: 100 },
  { key: "final", label: "Final", defaultMax: 100 },
];

const LETTER_COLOR = { A: "text-success", B: "text-success", C: "text-warning", D: "text-warning", F: "text-error" };

export default function GradesManagement() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [classSubjectMap, setClassSubjectMap] = useState({});

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);

  const [maxScores, setMaxScores] = useState(
    Object.fromEntries(COMPONENTS.map((c) => [c.key, c.defaultMax]))
  );
  const [scores, setScores] = useState({}); // studentId -> { assignment: '', quiz: '', ... }

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
    if (!classId || !subjectId) {
      setRows([]);
      return;
    }
    setLoadingRows(true);
    gradeService
      .getClassReport(classId, subjectId)
      .then((res) => {
        setRows(res.rows);

        // Pre-fill header maxScores from any already-entered data, so
        // re-opening a gradebook doesn't reset the scale.
        const nextMax = { ...maxScores };
        COMPONENTS.forEach((c) => {
          const found = res.rows.find((r) => r.components?.[c.key]?.maxScore);
          if (found) nextMax[c.key] = found.components[c.key].maxScore;
        });
        setMaxScores(nextMax);

        const nextScores = {};
        res.rows.forEach((r) => {
          nextScores[r.studentId] = {};
          COMPONENTS.forEach((c) => {
            const val = r.components?.[c.key]?.score;
            nextScores[r.studentId][c.key] = val !== null && val !== undefined ? String(val) : "";
          });
        });
        setScores(nextScores);
      })
      .catch((err) => toast.error(err.message || "Failed to load gradebook"))
      .finally(() => setLoadingRows(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId]);

  const setScore = (studentId, key, value) => {
    setScores((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const entries = rows.map((row) => ({
        studentId: row.studentId,
        components: Object.fromEntries(
          COMPONENTS.map((c) => {
            const raw = scores[row.studentId]?.[c.key];
            const score = raw === "" || raw === undefined ? null : Number(raw);
            return [c.key, { score, maxScore: maxScores[c.key] }];
          })
        ),
      }));
      const res = await gradeService.bulkUpsert({ classId, subjectId, entries });
      toast.success("Grades saved");
      // Refresh rows with the returned summaries
      setRows((prev) =>
        prev.map((row) => {
          const updated = res.grades.find((g) => g.student.toString() === row.studentId);
          return updated ? { ...row, summary: updated.summary, components: updated.components } : row;
        })
      );
    } catch (err) {
      toast.error(err.message || "Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) return <LoadingSpinner fullScreen />;

  if (!profile?.classes?.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Grades</h1>
        <p className="opacity-60 text-sm">
          You're not currently assigned to any class or subject. Ask an admin to assign you on the Classes page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Grades</h1>

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
                <option value="">Select subject...</option>
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

      {loadingRows ? (
        <LoadingSpinner />
      ) : classId && subjectId ? (
        rows.length === 0 ? (
          <p className="text-sm opacity-50 py-10 text-center">No students assigned to this class yet.</p>
        ) : (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Student</th>
                      {COMPONENTS.map((c) => (
                        <th key={c.key}>
                          <div className="flex flex-col gap-1">
                            <span>{c.label}</span>
                            <input
                              type="number"
                              min={1}
                              className="input input-bordered input-xs w-16"
                              value={maxScores[c.key]}
                              onChange={(e) =>
                                setMaxScores((prev) => ({ ...prev, [c.key]: Number(e.target.value) || 1 }))
                              }
                            />
                          </div>
                        </th>
                      ))}
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.studentId}>
                        <td className="font-medium">{row.name}</td>
                        {COMPONENTS.map((c) => (
                          <td key={c.key}>
                            <input
                              type="number"
                              min={0}
                              max={maxScores[c.key]}
                              className="input input-bordered input-xs w-16"
                              value={scores[row.studentId]?.[c.key] ?? ""}
                              onChange={(e) => setScore(row.studentId, c.key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <span className={`font-bold ${LETTER_COLOR[row.summary?.letter] || ""}`}>
                            {row.summary?.letter || "—"}
                          </span>
                          <span className="text-xs opacity-60 ml-1">
                            {row.summary?.percentage !== null && row.summary?.percentage !== undefined
                              ? `(${row.summary.percentage}%)`
                              : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <button className="btn btn-primary btn-sm" onClick={handleSaveAll} disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-xs"></span> : "Save All"}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <p className="text-sm opacity-50 py-10 text-center">Select a class and subject to begin.</p>
      )}
    </div>
  );
}
