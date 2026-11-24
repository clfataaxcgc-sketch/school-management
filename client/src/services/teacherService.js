import api from "./api.js";

const teacherService = {
  list: (params = {}) => api.get("/teachers", { params }).then((res) => res.data),
  get: (id) => api.get(`/teachers/${id}`).then((res) => res.data),
  getMe: () => api.get("/teachers/me").then((res) => res.data),
  create: (data) => api.post("/teachers", data).then((res) => res.data),
  update: (id, data) => api.put(`/teachers/${id}`, data).then((res) => res.data),
  remove: (id) => api.delete(`/teachers/${id}`).then((res) => res.data),
};

export default teacherService;
