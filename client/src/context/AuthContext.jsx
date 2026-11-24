import { createContext, useContext, useState, useEffect, useCallback } from "react";
import authService from "../services/authService.js";
import schoolService from "../services/schoolService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null); // the user's school (not used by the platform owner)
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  // Loads the school of a school user. The platform owner has no school.
  const loadSchool = useCallback(async (loggedInUser) => {
    if (!loggedInUser || loggedInUser.role === "platform_owner") {
      setSchool(null);
      return;
    }
    try {
      const res = await schoolService.getMine();
      setSchool(res.school);
    } catch {
      setSchool(null);
    }
  }, []);

  // On first load, ask the API who the current user is (cookie-based).
  // This lets a page refresh keep the user logged in.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await authService.getMe();
        setUser(res.user);
        await loadSchool(res.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [loadSchool]);

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials);
    if (res.token) localStorage.setItem("token", res.token);
    setUser(res.user);
    await loadSchool(res.user);
    return res.user;
  }, [loadSchool]);

  const register = useCallback(async (data) => {
    const res = await authService.register(data);
    if (res.token) localStorage.setItem("token", res.token);
    setUser(res.user);
    await loadSchool(res.user);
    return res.user;
  }, [loadSchool]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem("token");
      setUser(null);
      setSchool(null);
    }
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : prev));
  }, []);

  const value = {
    user,
    school,
    setSchool,
    role: user?.role || null,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
