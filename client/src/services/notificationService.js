import api from "./api.js";

const notificationService = {
  list: (limit = 20) => api.get("/notifications", { params: { limit } }).then((res) => res.data),
  markRead: (id) => api.put(`/notifications/${id}/read`).then((res) => res.data),
  markAllRead: () => api.put("/notifications/read-all").then((res) => res.data),
};

export default notificationService;
