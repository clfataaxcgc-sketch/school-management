import api from "./api.js";

const subjectService = {
  list: (params = {}) => api.get("/subjects", { params }).then((res) => res.data),
  get: (id) => api.get(`/subjects/${id}`).then((res) => res.data),
  create: (data) => api.post("/subjects", data).then((res) => res.data),
  update: (id, data) => api.put(`/subjects/${id}`, data).then((res) => res.data),
  remove: (id) => api.delete(`/subjects/${id}`).then((res) => res.data),
};

export default subjectService;
