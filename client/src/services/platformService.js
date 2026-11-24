import api from "./api.js";

// Platform owner (SaaS owner) endpoints.
const platformService = {
  getStats: () => api.get("/platform/stats").then((res) => res.data),
  getSchools: (params) => api.get("/platform/schools", { params }).then((res) => res.data),
  getSchool: (id) => api.get(`/platform/schools/${id}`).then((res) => res.data),
  setSchoolStatus: (id, status) =>
    api.patch(`/platform/schools/${id}/status`, { status }).then((res) => res.data),
};

export default platformService;
