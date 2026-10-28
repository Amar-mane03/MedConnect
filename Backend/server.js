const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const requiredProductionEnv = ["MONGO_URI", "JWT_SECRET", "ADMIN_SECRET", "FRONTEND_URL"];
const placeholderValue = (value) => !value || /^(your-|replace-with|example\.)/i.test(value.trim());
if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter((name) => placeholderValue(process.env[name]));
  if (missing.length > 0) {
    throw new Error(`Missing production environment values: ${missing.join(", ")}`);
  }

  const resendConfigured = !placeholderValue(process.env.RESEND_API_KEY) && !placeholderValue(process.env.EMAIL_FROM);
  const smtpConfigured = !placeholderValue(process.env.EMAIL_USER) && !placeholderValue(process.env.EMAIL_PASS);
  if (!resendConfigured && !smtpConfigured) {
    throw new Error("Configure RESEND_API_KEY and EMAIL_FROM for email delivery, or EMAIL_USER and EMAIL_PASS for SMTP.");
  }
}

const authRoutes = require("./routes/authRoutes");
const caseRoutes = require("./routes/caseRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const messageRoutes = require("./routes/messageRoutes");
const adminRoutes = require("./routes/adminRoutes");
const forumRoutes = require("./routes/forumRoutes");
const eventRoutes = require("./routes/eventRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const groupRoutes = require("./routes/groupRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const communityRoutes = require("./routes/communityRoutes");
const User = require("./models/user");
const { Conversation } = require("./models/Message");
const { JWT_SECRET } = require("./middlewares/authMiddleware");

const app = express();
const server = http.createServer(app);
const frontendOrigin = (process.env.FRONTEND_URL || "http://localhost:8443").trim().replace(/\/$/, "");
const frontendBuildDirectory = path.join(__dirname, "..", "Frontend", "dist");
const frontendOrigins = new Set([frontendOrigin]);
if (process.env.NODE_ENV !== "production") {
  try {
    const configuredOrigin = new URL(frontendOrigin);
    if (configuredOrigin.hostname === "localhost" || configuredOrigin.hostname === "127.0.0.1") {
      const alternateHost = configuredOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
      configuredOrigin.hostname = alternateHost;
      frontendOrigins.add(configuredOrigin.origin);
    }
  } catch (error) {
    throw new Error(`FRONTEND_URL is not a valid origin: ${error.message}`);
  }
}
function allowFrontendOrigin(origin, callback) {
  const isLocalDevelopmentOrigin = process.env.NODE_ENV !== "production"
    && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin || "");
  if (!origin || frontendOrigins.has(origin) || isLocalDevelopmentOrigin) return callback(null, true);
  return callback(new Error("Origin is not allowed by the CORS policy."));
}

// Middleware
// Initialize Socket.io for Real-Time Clinician Messaging
const io = new Server(server, {
  cors: {
    origin: allowFrontendOrigin,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  },
});

app.set("io", io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id isBanned");
    if (!user || user.isBanned) return next(new Error("Unauthorized"));
    socket.data.userId = user._id.toString();
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("join_conversation", async (conversationId) => {
    if (!socket.data.userId || !conversationId) return;
    const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.data.userId }).select("_id");
    if (conversation) socket.join(conversation._id.toString());
  });
  socket.on("join_user", () => { if (socket.data.userId) socket.join(socket.data.userId); });
  socket.on("typing", ({ conversationId, userName, isTyping }) => {
    if (socket.data.userId && conversationId && socket.rooms.has(conversationId.toString()))
      socket.to(conversationId.toString()).emit("user_typing", { userName, isTyping: Boolean(isTyping) });
  });
});

// Middlewares
app.use(cors({ origin: allowFrontendOrigin }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/mentors", mentorRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/forums", forumRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community", communityRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "MedConnect Clinical API & WebSocket Server is running",
    timestamp: new Date().toISOString(),
  });
});
app.use(express.static(frontendBuildDirectory));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendBuildDirectory, "index.html"));
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const uriDatabaseName = MONGO_URI
  ? decodeURIComponent(new URL(MONGO_URI).pathname.replace(/^\/+|\/+$/g, ""))
  : "";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME?.trim() || uriDatabaseName || "test";
const PORT = Number.parseInt(process.env.PORT || "5000", 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid TCP port between 1 and 65535.");
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server or configure a different PORT.`);
  } else {
    console.error("HTTP server failed to start:", error.message);
  }
  process.exit(1);
});

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
    console.log(`MongoDB connected successfully to database "${mongoose.connection.name}"`);
    server.listen(PORT, () => {
      console.log(`Server and Socket.io listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void startServer();
}

module.exports = app;
