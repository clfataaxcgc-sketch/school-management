import api from "./api.js";

const classService = {
  list: (params = {}) => api.get("/classes", { params }).then((res) => res.data),
  get: (id) => api.get(`/classes/${id}`).then((res) => res.data),
  create: (data) => api.post("/classes", data).then((res) => res.data),
  update: (id, data) => api.put(`/classes/${id}`, data).then((res) => res.data),
  updateSubjects: (id, subjects) =>
    api.put(`/classes/${id}/subjects`, { subjects }).then((res) => res.data),
  updateStudents: (id, studentIds) =>
    api.put(`/classes/${id}/students`, { studentIds }).then((res) => res.data),
  remove: (id) => api.delete(`/classes/${id}`).then((res) => res.data),
};

export default classService;
