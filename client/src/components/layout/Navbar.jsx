import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiMenu, FiLogOut, FiUser, FiMessageCircle } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import notificationService from "../../services/notificationService.js";

export default function Navbar({ onMenuClick }) {
  const { user, school, role, logout } = useAuth();
  // The platform owner has no school, so no messages or notifications.
  const isPlatformOwner = role === "platform_owner";
  const { onNotification } = useSocket();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = () => {
    if (isPlatformOwner) return;
    notificationService
      .list(10)
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {});
  };

  useEffect(loadNotifications, []);

  // Real-time: new notifications land instantly without a page refresh.
  useEffect(() => {
    const unsubscribe = onNotification((notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
      toast(notification.title, { icon: "🔔" });
    });
    return unsubscribe;
  }, [onNotification]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login", { replace: true });
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await notificationService.markRead(notification._id);
        setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        /* non-critical */
      }
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* non-critical */
    }
  };

  return (
    <div className="navbar bg-base-100 border-b border-base-300 px-4">
      <div className="flex-1 flex items-center gap-2">
        <button className="btn btn-ghost btn-sm lg:hidden" onClick={onMenuClick}>
          <FiMenu size={20} />
        </button>
        {school?.logo && (
          <img src={school.logo} alt="" className="h-8 w-8 rounded object-cover" />
        )}
        <span className="font-semibold text-lg">
          {isPlatformOwner ? "Platform Administration" : school?.schoolName || "School Management System"}
        </span>
      </div>

      <div className="flex-none gap-1">
        {!isPlatformOwner && (
          <button className="btn btn-ghost btn-circle" aria-label="Messages" onClick={() => navigate("/messages")}>
            <FiMessageCircle size={20} />
          </button>
        )}

        {!isPlatformOwner && (
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle" aria-label="Notifications">
            <div className="indicator">
              <FiBell size={20} />
              {unreadCount > 0 && (
                <span className="badge badge-primary badge-xs indicator-item">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </div>
          </label>
          <div tabIndex={0} className="dropdown-content z-[1] mt-3 w-80 bg-base-100 rounded-box shadow-lg border border-base-300">
            <div className="flex items-center justify-between p-3 border-b border-base-300">
              <p className="font-semibold text-sm">Notifications</p>
              {unreadCount > 0 && (
                <button className="btn btn-ghost btn-xs" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm opacity-50 p-4 text-center">No notifications yet</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left p-3 border-b border-base-200 hover:bg-base-200 ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs opacity-60 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] opacity-40 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost flex items-center gap-2">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-8">
                <span className="text-xs">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
              </div>
            </div>
            <span className="hidden sm:inline text-sm">{user?.firstName}</span>
          </label>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-48"
          >
            <li>
              <a onClick={() => navigate("/profile")}>
                <FiUser /> Profile
              </a>
            </li>
            <li>
              <a onClick={handleLogout}>
                <FiLogOut /> Logout
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
