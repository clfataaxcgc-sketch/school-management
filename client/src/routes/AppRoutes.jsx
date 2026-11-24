import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "../components/common/LoadingSpinner.jsx";

import Login from "../pages/auth/Login.jsx";
import Register from "../pages/auth/Register.jsx";
import ForgotPassword from "../pages/auth/ForgotPassword.jsx";
import ResetPassword from "../pages/auth/ResetPassword.jsx";

import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

import AdminDashboard from "../pages/dashboards/AdminDashboard.jsx";
import TeacherDashboard from "../pages/dashboards/TeacherDashboard.jsx";
import StudentDashboard from "../pages/dashboards/StudentDashboard.jsx";

import Profile from "../pages/profile/Profile.jsx";
import ChangePassword from "../pages/profile/ChangePassword.jsx";
import Messages from "../pages/messages/Messages.jsx";

import StudentsManagement from "../pages/admin/StudentsManagement.jsx";
import TeachersManagement from "../pages/admin/TeachersManagement.jsx";
import ClassesManagement from "../pages/admin/ClassesManagement.jsx";
import SubjectsManagement from "../pages/admin/SubjectsManagement.jsx";
import AdminReports from "../pages/admin/Reports.jsx";
import SchoolSettings from "../pages/admin/SchoolSettings.jsx";
import PlatformDashboard from "../pages/platform/PlatformDashboard.jsx";

import TakeAttendance from "../pages/teacher/TakeAttendance.jsx";
import AssignmentsManagement from "../pages/teacher/AssignmentsManagement.jsx";
import GradesManagement from "../pages/teacher/GradesManagement.jsx";
import TeacherReports from "../pages/teacher/Reports.jsx";
import MyAttendance from "../pages/student/MyAttendance.jsx";
import MyAssignments from "../pages/student/MyAssignments.jsx";
import MyGrades from "../pages/student/MyGrades.jsx";

import { getDashboardPath } from "../utils/roleRedirect.js";

function RootRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return <Navigate to={isAuthenticated ? getDashboardPath(role) : "/login"} replace />;
}

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-2">
      <h1 className="text-3xl font-bold">403</h1>
      <p className="opacity-70">You don&apos;t have permission to view this page.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-2">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="opacity-70">Page not found.</p>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Public / auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Shared protected routes (any authenticated role) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>
      </Route>

      {/* Messages: school users only (the platform owner has no school) */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "teacher", "student"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/messages" element={<Messages />} />
        </Route>
      </Route>

      {/* Platform owner (SaaS owner) */}
      <Route element={<ProtectedRoute allowedRoles={["platform_owner"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/platform/dashboard" element={<PlatformDashboard />} />
        </Route>
      </Route>

      {/* Role-scoped dashboards */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/students" element={<StudentsManagement />} />
          <Route path="/admin/teachers" element={<TeachersManagement />} />
          <Route path="/admin/classes" element={<ClassesManagement />} />
          <Route path="/admin/subjects" element={<SubjectsManagement />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/school" element={<SchoolSettings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["teacher"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/attendance" element={<TakeAttendance />} />
          <Route path="/teacher/assignments" element={<AssignmentsManagement />} />
          <Route path="/teacher/grades" element={<GradesManagement />} />
          <Route path="/teacher/reports" element={<TeacherReports />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/attendance" element={<MyAttendance />} />
          <Route path="/student/assignments" element={<MyAssignments />} />
          <Route path="/student/grades" element={<MyGrades />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
