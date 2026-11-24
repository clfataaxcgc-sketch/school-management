// Central place that maps a role to its dashboard route, so the redirect
// logic after login / on "/" is defined once.
const roleDashboardPath = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
  platform_owner: "/platform/dashboard",
};

export const getDashboardPath = (role) => roleDashboardPath[role] || "/login";

export default roleDashboardPath;
