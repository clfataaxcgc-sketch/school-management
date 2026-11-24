const roleBadge = {
  admin: "badge-primary",
  teacher: "badge-success",
  student: "badge-info",
};

export default function RecentRegistrationsTable({ users }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title text-base">Recent Registrations</h2>

        {users.length === 0 ? (
          <p className="text-sm opacity-50 py-6 text-center">No registrations yet</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="font-medium">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="opacity-70">{u.email}</td>
                    <td>
                      <span className={`badge badge-sm ${roleBadge[u.role] || ""} capitalize`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm ${
                          u.status === "active" ? "badge-outline" : "badge-error badge-outline"
                        } capitalize`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="opacity-60 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
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
