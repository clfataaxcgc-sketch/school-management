import { useEffect, useState, useCallback } from "react";
import { FiHome, FiCheckCircle, FiSlash, FiUsers, FiSearch, FiEye } from "react-icons/fi";
import toast from "react-hot-toast";
import platformService from "../../services/platformService.js";
import StatCard from "../../components/dashboard/StatCard.jsx";
import Modal from "../../components/common/Modal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import LoadingSpinner from "../../components/common/LoadingSpinner.jsx";

// Dashboard of the platform owner (the SaaS owner).
// It shows schools only: name, status and head-counts. It never shows a
// school's students, grades or messages.
export default function PlatformDashboard() {
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [details, setDetails] = useState(null); // school shown in the details modal
  const [statusTarget, setStatusTarget] = useState(null); // school waiting for confirmation
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await platformService.getStats();
      setStats(res.stats);
    } catch (err) {
      toast.error(err.message || "Failed to load statistics");
    }
  }, []);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformService.getSchools({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setSchools(res.schools);
    } catch (err) {
      toast.error(err.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Wait a little after typing so we do not call the API on every key press.
  useEffect(() => {
    const timer = setTimeout(loadSchools, 300);
    return () => clearTimeout(timer);
  }, [loadSchools]);

  const openDetails = async (school) => {
    try {
      const res = await platformService.getSchool(school._id);
      setDetails(res.school);
    } catch (err) {
      toast.error(err.message || "Failed to load school");
    }
  };

  const confirmStatusChange = async () => {
    const newStatus = statusTarget.status === "active" ? "inactive" : "active";
    setSaving(true);
    try {
      await platformService.setSchoolStatus(statusTarget._id, newStatus);
      toast.success(newStatus === "active" ? "School activated" : "School deactivated");
      setStatusTarget(null);
      loadStats();
      loadSchools();
    } catch (err) {
      toast.error(err.message || "Failed to update school");
    } finally {
      setSaving(false);
    }
  };

  const deactivating = statusTarget?.status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Platform Dashboard</h1>
        <p className="opacity-70">All schools registered on the platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Schools" value={stats?.totalSchools ?? "-"} icon={<FiHome />} />
        <StatCard label="Active Schools" value={stats?.activeSchools ?? "-"} icon={<FiCheckCircle />} />
        <StatCard label="Inactive Schools" value={stats?.inactiveSchools ?? "-"} icon={<FiSlash />} />
        <StatCard label="Total Users" value={stats?.totalUsers ?? "-"} icon={<FiUsers />} />
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
              <FiSearch />
              <input
                type="text"
                className="grow"
                placeholder="Search by school name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="select select-bordered select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : schools.length === 0 ? (
            <p className="text-center opacity-60 py-8">No schools found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Email</th>
                    <th>Students</th>
                    <th>Teachers</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school._id}>
                      <td className="font-medium">{school.schoolName}</td>
                      <td>{school.schoolEmail}</td>
                      <td>{school.userCounts.student}</td>
                      <td>{school.userCounts.teacher}</td>
                      <td>{new Date(school.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge badge-sm ${school.status === "active" ? "badge-success" : "badge-error"}`}>
                          {school.status}
                        </span>
                      </td>
                      <td className="flex gap-1 justify-end">
                        <button className="btn btn-ghost btn-xs" onClick={() => openDetails(school)} aria-label="View school">
                          <FiEye />
                        </button>
                        <button
                          className={`btn btn-xs ${school.status === "active" ? "btn-error btn-outline" : "btn-success btn-outline"}`}
                          onClick={() => setStatusTarget(school)}
                        >
                          {school.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.schoolName || "School"}>
        {details && (
          <dl className="space-y-2 text-sm">
            <div><dt className="opacity-60">Email</dt><dd>{details.schoolEmail}</dd></div>
            <div><dt className="opacity-60">Address</dt><dd>{details.schoolAddress || "-"}</dd></div>
            <div><dt className="opacity-60">Phone</dt><dd>{details.phone || "-"}</dd></div>
            <div><dt className="opacity-60">Status</dt><dd>{details.status}</dd></div>
            <div><dt className="opacity-60">Registered</dt><dd>{new Date(details.createdAt).toLocaleString()}</dd></div>
            <div>
              <dt className="opacity-60">Admin</dt>
              <dd>{details.admin ? `${details.admin.firstName} ${details.admin.lastName} (${details.admin.email})` : "-"}</dd>
            </div>
            <div>
              <dt className="opacity-60">Users</dt>
              <dd>
                {details.userCounts.admin} admin, {details.userCounts.teacher} teachers, {details.userCounts.student} students
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={!!statusTarget}
        title={deactivating ? "Deactivate school?" : "Activate school?"}
        message={
          deactivating
            ? `${statusTarget?.schoolName} will be logged out and nobody from this school can use the app until you activate it again.`
            : `${statusTarget?.schoolName} will be able to use the app again.`
        }
        confirmLabel={deactivating ? "Deactivate" : "Activate"}
        confirmClass={deactivating ? "btn-error" : "btn-success"}
        loading={saving}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
