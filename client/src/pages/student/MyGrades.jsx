import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import gradeService from "../../services/gradeService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import GradeCard from "../../components/grades/GradeCard.jsx";

export default function MyGrades() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gradeService
      .getMyGrades()
      .then((res) => setGrades(res.grades))
      .catch((err) => toast.error(err.message || "Failed to load grades"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Grades</h1>
      {grades.length === 0 ? (
        <p className="text-sm opacity-50 py-10 text-center">No grades entered yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {grades.map((g, i) => (
            <GradeCard key={i} grade={g} />
          ))}
        </div>
      )}
    </div>
  );
}
