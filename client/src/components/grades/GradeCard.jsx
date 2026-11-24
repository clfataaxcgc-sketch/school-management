const LETTER_COLOR = {
  A: "text-success",
  B: "text-success",
  C: "text-warning",
  D: "text-warning",
  F: "text-error",
};

const COMPONENT_LABELS = { assignment: "Assignment", quiz: "Quiz", midterm: "Midterm", final: "Final" };

export default function GradeCard({ grade }) {
  const { summary, components } = grade;

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold">{grade.subject}</h3>
            <p className="text-xs opacity-60">{grade.class}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${LETTER_COLOR[summary.letter] || ""}`}>{summary.letter || "—"}</p>
            <p className="text-xs opacity-60">{summary.percentage !== null ? `${summary.percentage}%` : "No grades yet"}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3 text-center text-sm">
          {Object.entries(COMPONENT_LABELS).map(([key, label]) => {
            const c = components?.[key];
            return (
              <div key={key} className="bg-base-200 rounded p-2">
                <p className="font-semibold">
                  {c?.score !== null && c?.score !== undefined ? `${c.score}/${c.maxScore}` : "—"}
                </p>
                <p className="text-[10px] opacity-60">{label}</p>
              </div>
            );
          })}
        </div>

        {summary.average !== null && (
          <p className="text-xs opacity-60 mt-2">Average across entered components: {summary.average}%</p>
        )}
      </div>
    </div>
  );
}
