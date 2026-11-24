import api from "./api.js";

const gradeService = {
  upsert: (data) => api.put("/grades", data).then((res) => res.data),
  bulkUpsert: (data) => api.put("/grades/bulk", data).then((res) => res.data),
  getClassReport: (classId, subjectId) =>
    api.get(`/grades/class/${classId}/report`, { params: { subjectId } }).then((res) => res.data),
  getStudentGrades: (studentId, params = {}) =>
    api.get(`/grades/student/${studentId}`, { params }).then((res) => res.data),
  getMyGrades: (params = {}) => api.get("/grades/me", { params }).then((res) => res.data),
};

export default gradeService;
