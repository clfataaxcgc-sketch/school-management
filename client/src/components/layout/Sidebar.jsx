import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiUser,
  FiUsers,
  FiUserCheck,
  FiGrid,
  FiBook,
  FiCheckSquare,
  FiClipboard,
  FiAward,
  FiBarChart2,
  FiSettings,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import { getDashboardPath } from "../../utils/roleRedirect.js";

const roleLabel = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  platform_owner: "Platform Owner",
};

// Links beyond Dashboard/Profile that only make sense for a given role.
const roleLinks = {
  admin: [
    { to: "/admin/students", label: "Students", icon: <FiUsers /> },
    { to: "/admin/teachers", label: "Teachers", icon: <FiUserCheck /> },
    { to: "/admin/classes", label: "Classes", icon: <FiGrid /> },
    { to: "/admin/subjects", label: "Subjects", icon: <FiBook /> },
    { to: "/admin/reports", label: "Reports", icon: <FiBarChart2 /> },
    { to: "/admin/school", label: "School Settings", icon: <FiSettings /> },
  ],
  teacher: [
    { to: "/teacher/attendance", label: "Take Attendance", icon: <FiCheckSquare /> },
    { to: "/teacher/assignments", label: "Assignments", icon: <FiClipboard /> },
    { to: "/teacher/grades", label: "Grades", icon: <FiAward /> },
    { to: "/teacher/reports", label: "Reports", icon: <FiBarChart2 /> },
  ],
  student: [
    { to: "/student/attendance", label: "My Attendance", icon: <FiCheckSquare /> },
    { to: "/student/assignments", label: "Assignments", icon: <FiClipboard /> },
    { to: "/student/grades", label: "Grades", icon: <FiAward /> },
  ],
};

export default function Sidebar({ role, open, onClose }) {
  const { school } = useAuth();
  const links = [
    { to: getDashboardPath(role), label: "Dashboard", icon: <FiHome /> },
    ...(roleLinks[role] || []),
    { to: "/profile", label: "Profile", icon: <FiUser /> },
  ];

  return (
    <>
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-base-100 border-r border-base-300 transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="p-4 border-b border-base-300">
          <p className="font-bold">{roleLabel[role] || "User"} Panel</p>
          {school && <p className="text-xs opacity-60 truncate">{school.schoolName}</p>}
        </div>
        <ul className="menu p-2 gap-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                onClick={onClose}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {link.icon}
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
