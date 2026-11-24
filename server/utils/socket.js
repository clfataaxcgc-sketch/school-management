const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");

// Module-level singleton: server.js calls initSocket() once at boot;
// controllers elsewhere call getIO() to emit without needing the instance
// threaded through every function call.
let io = null;

// userId (string) -> Set of connected socket ids. A user can have more
// than one tab/device open, so "online" means the set is non-empty.
const onlineUsers = new Map();

// Checks the JWT the same way the protect middleware does: the user must
// exist and be active, and the school must exist and be active.
// Returns the user, or throws an Error if the socket must be refused.
const authenticateSocket = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);
  if (!user || user.status !== "active") throw new Error("Authentication failed");

  // Platform owners have no school and do not use real-time school features.
  if (!user.schoolId || !decoded.schoolId) throw new Error("Authentication failed");
  if (String(decoded.schoolId) !== String(user.schoolId)) throw new Error("Authentication failed");

  const school = await School.findById(user.schoolId);
  if (!school || school.status !== "active") throw new Error("School is not active");

  return user;
};

const initSocket = (httpServer, corsOrigin) => {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  // Every socket must authenticate with the same JWT used for API auth
  // (sent as `auth: { token }` on the client) — no anonymous sockets.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const user = await authenticateSocket(token);
      socket.userId = user._id.toString();
      socket.schoolId = user.schoolId.toString();
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.userId;
    const schoolRoom = `school:${socket.schoolId}`;

    // Personal room so we can push events to "this user" (all their tabs)
    // without knowing which conversation/page they currently have open.
    socket.join(`user:${uid}`);
    // School room: used for presence, so it never leaves the school.
    socket.join(schoolRoom);

    if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
    const wasOffline = onlineUsers.get(uid).size === 0;
    onlineUsers.get(uid).add(socket.id);
    if (wasOffline) io.to(schoolRoom).emit("presence:update", { userId: uid, online: true });

    socket.on("disconnect", () => {
      const set = onlineUsers.get(uid);
      if (!set) return;
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(uid);
        io.to(schoolRoom).emit("presence:update", { userId: uid, online: false });
      }
    });
  });

  return io;
};

const getIO = () => io;
const isOnline = (userId) => onlineUsers.has(userId.toString());
const getOnlineUserIds = () => [...onlineUsers.keys()];

// Used when a school is deactivated: kicks every connected user of that school.
const disconnectSchool = (schoolId) => {
  if (io) io.in(`school:${schoolId}`).disconnectSockets(true);
};

module.exports = { initSocket, getIO, isOnline, getOnlineUserIds, disconnectSchool, authenticateSocket };
