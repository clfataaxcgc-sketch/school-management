import api from "./api.js";

const adminService = {
  getStats: () => api.get("/admin/stats").then((res) => res.data),
  getRecentRegistrations: (limit = 8) =>
    api.get(`/admin/recent-registrations?limit=${limit}`).then((res) => res.data),
  getUserGrowth: (months = 6) =>
    api.get(`/admin/user-growth?months=${months}`).then((res) => res.data),
};

export default adminService;
