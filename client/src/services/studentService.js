import api from "./api.js";

const studentService = {
  list: (params = {}) => api.get("/students", { params }).then((res) => res.data),
  get: (id) => api.get(`/students/${id}`).then((res) => res.data),
  create: (data) => api.post("/students", data).then((res) => res.data),
  update: (id, data) => api.put(`/students/${id}`, data).then((res) => res.data),
  remove: (id) => api.delete(`/students/${id}`).then((res) => res.data),
};

export default studentService;
