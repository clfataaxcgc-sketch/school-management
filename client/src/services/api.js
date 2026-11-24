import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Uploaded file attachments are served as static assets outside /api (see
// server.js). Derive the server's origin from the API URL so
// `${SERVER_URL}${attachment.url}` produces a working link regardless of
// environment, without a second env var to keep in sync.
export const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

// Central axios instance. withCredentials sends the httpOnly auth cookie
// on every request; we also attach a bearer token from localStorage as a
// fallback for environments where third-party cookies get blocked.
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalizes error shape so components can just read err.message
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Something went wrong";

    // If the platform owner deactivates the school while someone is logged in,
    // the API answers 403. Log the user out and explain why on the login page.
    const isLoginRequest = error.config?.url?.includes("/auth/login");
    const onLoginPage = window.location.pathname === "/login";
    if (
      error.response?.status === 403 &&
      /school has been deactivated/i.test(message) &&
      !isLoginRequest &&
      !onLoginPage
    ) {
      localStorage.removeItem("token");
      sessionStorage.setItem("loginNotice", message);
      window.location.href = "/login";
    }

    return Promise.reject({ ...error, message });
  }
);

export default api;
