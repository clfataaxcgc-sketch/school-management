const STATUS_BADGE = {
  present: "badge-success",
  absent: "badge-error",
  late: "badge-warning",
  excused: "badge-info",
};

export default function AttendanceHistoryTable({ history }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-0">
        {history.length === 0 ? (
          <p className="text-sm opacity-50 py-10 text-center">No attendance records in this range</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="text-xs">{new Date(h.date).toLocaleDateString()}</td>
                    <td>{h.class}</td>
                    <td>{h.subject}</td>
                    <td>
                      <span className={`badge badge-sm capitalize ${STATUS_BADGE[h.status] || ""}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
