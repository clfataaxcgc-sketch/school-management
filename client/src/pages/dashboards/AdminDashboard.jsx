import { useEffect, useState } from "react";
import { FiUsers, FiUserCheck, FiGrid, FiCheckSquare, FiAward } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";
import StatCard from "../../components/dashboard/StatCard.jsx";
import ComingSoonCard from "../../components/dashboard/ComingSoonCard.jsx";
import UserGrowthChart from "../../components/dashboard/UserGrowthChart.jsx";
import RoleDistributionChart from "../../components/dashboard/RoleDistributionChart.jsx";
import RecentRegistrationsTable from "../../components/dashboard/RecentRegistrationsTable.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, growthRes, recentRes] = await Promise.all([
          adminService.getStats(),
          adminService.getUserGrowth(6),
          adminService.getRecentRegistrations(8),
        ]);
        setStats(statsRes.stats);
        setGrowth(growthRes.series);
        setRecentUsers(recentRes.users);
      } catch (err) {
        toast.error(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Welcome, {user?.firstName}</h1>
        <p className="opacity-70">School overview and statistics</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={<FiUsers />} />
        <StatCard label="Total Teachers" value={stats.totalTeachers} icon={<FiUserCheck />} />
        <StatCard
          label="Total Classes"
          unavailable={!stats.totalClasses.available}
          note={stats.totalClasses.comingIn}
          value={stats.totalClasses.value}
          icon={<FiGrid />}
        />
        <StatCard
          label="Attendance (30d)"
          unavailable={!stats.attendancePercentage.available}
          note={stats.attendancePercentage.comingIn}
          value={stats.attendancePercentage.available ? `${stats.attendancePercentage.value}%` : null}
          icon={<FiCheckSquare />}
        />
        <StatCard
          label="Average Grade"
          unavailable={!stats.averageGrade.available}
          note={stats.averageGrade.comingIn}
          value={stats.averageGrade.available ? `${stats.averageGrade.value}%` : null}
          icon={<FiAward />}
        />
      </div>

      {/* Real charts, built from existing User data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UserGrowthChart data={growth} />
        <RoleDistributionChart stats={stats} />
      </div>

      <RecentRegistrationsTable users={recentUsers} />

      {/* Sections that depend on models from later phases */}
      <div className="grid grid-cols-1 gap-4">
        <ComingSoonCard
          title="Recent Announcements"
          description="The latest school announcements will appear here once the Announcement module (Phase 17) is built."
        />
      </div>
    </div>
  );
}
