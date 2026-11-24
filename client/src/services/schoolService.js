import api from "./api.js";

// The logged-in user's own school (the server reads the school from the token).
const schoolService = {
  getMine: () => api.get("/schools/me").then((res) => res.data),
  updateMine: (data) => api.put("/schools/me", data).then((res) => res.data),
};

export default schoolService;
