import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Stacked-by-role monthly registration counts. Real data (from the User
// collection's createdAt), not mocked.
export default function UserGrowthChart({ data }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="card-title text-base">New Registrations (last 6 months)</h2>
        <div className="h-72 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="student" stackId="a" name="Students" fill="#3b82f6" />
              <Bar dataKey="teacher" stackId="a" name="Teachers" fill="#10b981" />
              <Bar dataKey="admin" stackId="a" name="Admins" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
