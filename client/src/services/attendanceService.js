import api from "./api.js";

const attendanceService = {
  take: (data) => api.post("/attendance", data).then((res) => res.data),
  getSession: (classId, subjectId, date) =>
    api.get("/attendance/session", { params: { classId, subjectId, date } }).then((res) => res.data),
  getClassReport: (classId, params = {}) =>
    api.get(`/attendance/class/${classId}/report`, { params }).then((res) => res.data),
  getStudentAttendance: (studentId, params = {}) =>
    api.get(`/attendance/student/${studentId}`, { params }).then((res) => res.data),
  getMyAttendance: (params = {}) => api.get("/attendance/me", { params }).then((res) => res.data),
};

export default attendanceService;
