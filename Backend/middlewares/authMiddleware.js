const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === "production" ? null : crypto.randomBytes(32).toString("hex")
);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured before starting the backend.");
}

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required. Please sign in." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User account no longer exists." });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: "This account has been suspended by an administrator." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session token. Please sign in again." });
  }
};

// Case publishing rights only to the mentors (as explicitly requested)
const requireMentor = (req, res, next) => {
  if (!req.user || req.user.role !== "mentor") {
    return res.status(403).json({ message: "Only verified clinician mentors have rights to publish case studies." });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Administrator privileges required for this action." });
  }
  next();
};

module.exports = {
  requireAuth,
  requireMentor,
  requireAdmin,
  JWT_SECRET,
};
