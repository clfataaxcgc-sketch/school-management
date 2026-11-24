import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = { Students: "#3b82f6", Teachers: "#10b981", Admins: "#8b5cf6" };

export default function RoleDistributionChart({ stats }) {
  const data = [
    { name: "Students", value: stats.totalStudents },
    { name: "Teachers", value: stats.totalTeachers },
    { name: "Admins", value: stats.totalAdmins },
  ].filter((d) => d.value > 0);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title text-base">User Distribution</h2>
        <div className="h-72 mt-2">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm opacity-50">
              No users yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
