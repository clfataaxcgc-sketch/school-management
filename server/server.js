require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const connectDB = require("./config/db");
const routes = require("./routes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { protect } = require("./middleware/auth");
const { onlyOwnSchoolFiles } = require("./middleware/uploadAccess");
const { initSocket } = require("./utils/socket");

// In production a weak or missing JWT secret would let anyone forge a login
// token (for any school), so refuse to start.
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32 || secret.startsWith("replace_with")) {
    console.error("JWT_SECRET must be a random string of at least 32 characters in production.");
    process.exit(1);
  }
}

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// --- Security & parsing middleware ---
// crossOriginResourcePolicy defaults to "same-origin", which would block
// the client (a different origin in dev — different port) from loading
// uploaded attachments served below. Everything else stays at helmet's
// secure defaults.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// CORS alone does not stop cross-site HTML form submissions. For browser
// requests that can change state, reject an unexpected Origin explicitly.
// Requests from non-browser clients without an Origin remain supported.
const allowedOrigins = new Set([CLIENT_URL]);
app.use((req, res, next) => {
  const isReadOnly = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const origin = req.get("origin");
  if (!isReadOnly && origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({
      success: false,
      message: "Request origin is not allowed",
    });
  }
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from req.body/query/params
app.use(xss()); // sanitizes user input against basic XSS

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Uploaded assignment/submission files — served outside /api since they're
// static assets, not JSON API responses. Frontend builds URLs as
// `${SERVER_ORIGIN}${attachment.url}` (see client/src/services/api.js).
// Files are private: you must be logged in AND the file must be inside your
// own school's folder (/uploads/<schoolId>/...).
app.use(
  "/uploads",
  protect,
  onlyOwnSchoolFiles,
  express.static(path.join(__dirname, "uploads"), { dotfiles: "deny" })
);

app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    status: databaseReady ? "healthy" : "degraded",
    database: databaseReady ? "connected" : "disconnected",
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

// Wrap in a plain http.Server so Socket.IO can share the same port as the
// REST API — real-time messaging/notifications (Phase 8) run over this.
const server = http.createServer(app);
initSocket(server, CLIENT_URL);

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  await connectDB();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => {
      server.removeListener("error", reject);
      console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
      resolve(server);
    });
  });
};

// Importing the app in tests must not start a listener or a background DB
// connection. Production/development startup always waits for MongoDB.
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.server = server;
