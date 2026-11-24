import api from "./api.js";

const reportService = {
  getAttendanceTrend: (classId, params = {}) =>
    api.get("/reports/attendance-trend", { params: { classId, ...params } }).then((res) => res.data),
  getGradeDistribution: (params = {}) =>
    api.get("/reports/grade-distribution", { params }).then((res) => res.data),
  getClassComparison: () => api.get("/reports/class-comparison").then((res) => res.data),
  // CSV exports are plain downloads, not JSON — build the URL and let the
  // browser handle it (auth cookie rides along via withCredentials on
  // same-origin navigation is NOT guaranteed for a plain <a>, so we open
  // it with the bearer token as a query param the backend also accepts... 
  // simplest robust approach: fetch as blob using the existing axios
  // instance so auth headers are attached, then trigger a download.
  downloadAttendanceCsv: async (classId, params = {}) => {
    const res = await api.get("/reports/attendance/export", { params: { classId, ...params }, responseType: "blob" });
    return res.data;
  },
  downloadGradesCsv: async (classId, subjectId) => {
    const res = await api.get("/reports/grades/export", { params: { classId, subjectId }, responseType: "blob" });
    return res.data;
  },
};

export const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export default reportService;
