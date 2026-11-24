const STATUS_COLORS = {
  present: "text-success",
  absent: "text-error",
  late: "text-warning",
  excused: "text-info",
};

export default function AttendanceSummaryCard({ percentage, counts }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title text-base">Attendance</h2>
        <div className="flex items-end gap-2 mt-1 mb-4">
          <span className="text-4xl font-bold">{percentage !== null ? `${percentage}%` : "—"}</span>
          {percentage === null && <span className="text-xs opacity-50 mb-1">No records yet</span>}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status}>
              <p className={`font-bold ${STATUS_COLORS[status]}`}>{count}</p>
              <p className="opacity-60 capitalize text-xs">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
