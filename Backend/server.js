const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const requiredProductionEnv = ["MONGO_URI", "EMAIL_USER", "EMAIL_PASS", "JWT_SECRET", "ADMIN_SECRET", "FRONTEND_URL"];
const placeholderValue = (value) => !value || /^(your-|replace-with|example\.)/i.test(value.trim());
if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter((name) => placeholderValue(process.env[name]));
  if (missing.length > 0) {
    throw new Error(`Missing production environment values: ${missing.join(", ")}`);
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
const User = require("./models/user");
const { Conversation } = require("./models/Message");
const { JWT_SECRET } = require("./middlewares/authMiddleware");

const app = express();
const server = http.createServer(app);
const frontendOrigin = (process.env.FRONTEND_URL || "http://localhost:8443").trim().replace(/\/$/, "");

// Middleware
// Initialize Socket.io for Real-Time Clinician Messaging
const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
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

// Socket.io Connection & Room Handling
io.on("connection", (socket) => {
  // Join conversation thread room
  socket.on("join_conversation", async (conversationId) => {
    if (!socket.data.userId || !conversationId) return;
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: socket.data.userId,
    }).select("_id");
    if (conversation) socket.join(conversation._id.toString());
  });

  // Join personal user room for direct notification alerts
  socket.on("join_user", () => {
    if (socket.data.userId) socket.join(socket.data.userId);
  });

  // Typing indicator
  socket.on("typing", ({ conversationId, userName, isTyping }) => {
    if (socket.data.userId && conversationId && socket.rooms.has(conversationId.toString())) {
      socket.to(conversationId.toString()).emit("user_typing", { userName, isTyping: Boolean(isTyping) });
    }
  });

  socket.on("disconnect", () => {
    // client disconnected
  });
});

// Middlewares
app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

// Routes
// API Routes
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

// Test

// Health Check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "MedConnect Clinical API & WebSocket Server is running",
    timestamp: new Date().toISOString(),
  });
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    server.listen(PORT, () => {
      console.log(`Server and Socket.io listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

