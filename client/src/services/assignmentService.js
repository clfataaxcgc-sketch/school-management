import api from "./api.js";

const assignmentService = {
  list: (params = {}) => api.get("/assignments", { params }).then((res) => res.data),
  get: (id, params = {}) => api.get(`/assignments/${id}`, { params }).then((res) => res.data),
  create: (data) => api.post("/assignments", data).then((res) => res.data),
  update: (id, data) => api.put(`/assignments/${id}`, data).then((res) => res.data),
  remove: (id) => api.delete(`/assignments/${id}`).then((res) => res.data),
  submit: (id, data) => api.post(`/assignments/${id}/submit`, data).then((res) => res.data),
  grade: (id, submissionId, data) =>
    api.put(`/assignments/${id}/submissions/${submissionId}/grade`, data).then((res) => res.data),
};

export default assignmentService;
