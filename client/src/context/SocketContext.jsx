import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { SERVER_URL } from "../services/api.js";

const SocketContext = createContext(null);

// One socket connection per logged-in session, authenticated with the same
// JWT used for REST calls. Exposes presence (who's online) and a simple
// pub/sub for "new_message" and "notification" events so any page can
// subscribe without owning the connection itself.
export function SocketProvider({ children }) {
  const { isAuthenticated, role } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const listenersRef = useRef({ message: new Set(), notification: new Set() });

  useEffect(() => {
    // The platform owner has no school, so there is nothing to listen to.
    if (!isAuthenticated || role === "platform_owner") {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("presence:update", ({ userId, online }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on("new_message", (payload) => {
      listenersRef.current.message.forEach((cb) => cb(payload));
    });

    socket.on("notification", (payload) => {
      listenersRef.current.notification.forEach((cb) => cb(payload));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, role]);

  const onNewMessage = useCallback((cb) => {
    listenersRef.current.message.add(cb);
    return () => listenersRef.current.message.delete(cb);
  }, []);

  const onNotification = useCallback((cb) => {
    listenersRef.current.notification.add(cb);
    return () => listenersRef.current.notification.delete(cb);
  }, []);

  const isUserOnline = useCallback((userId) => onlineUserIds.has(userId), [onlineUserIds]);

  return (
    <SocketContext.Provider value={{ connected, onNewMessage, onNotification, isUserOnline }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
};
