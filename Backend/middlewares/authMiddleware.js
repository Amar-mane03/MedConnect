const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");

function loadJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    if (configuredSecret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters long.");
    }
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured before starting the backend.");
  }

  const secretPath = path.join(__dirname, "..", ".jwt-secret");
  try {
    const persistedSecret = fs.readFileSync(secretPath, "utf8").trim();
    if (persistedSecret.length < 32) {
      throw new Error("The local JWT secret file is invalid. Remove Backend/.jwt-secret and restart the backend to generate a new one.");
    }
    return persistedSecret;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generatedSecret = crypto.randomBytes(64).toString("hex");
  try {
    fs.writeFileSync(secretPath, generatedSecret, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return generatedSecret;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw new Error(`Unable to persist local JWT secret at ${secretPath}: ${error.message}`);
    }
    const persistedSecret = fs.readFileSync(secretPath, "utf8").trim();
    if (persistedSecret.length < 32) {
      throw new Error("The local JWT secret file is invalid.");
    }
    return persistedSecret;
  }
}

const JWT_SECRET = loadJwtSecret();

const authenticate = async (req, res, next, allowUnverified = false, allowAnonymous = false) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required. Please sign in." });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      if (allowAnonymous) return next();
      return res.status(401).json({ message: "Invalid or expired session token. Please sign in again." });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      if (allowAnonymous) return next();
      return res.status(401).json({ message: "User account no longer exists." });
    }

    if (user.isBanned) {
      if (allowAnonymous) return next();
      return res.status(403).json({ message: "This account has been suspended by an administrator." });
    }

    if (!allowUnverified && user.emailVerified === false && user.emailVerificationToken) {
      return res.status(403).json({ message: "Please verify your email before accessing MedConnect." });
    }

    req.user = user;
    next();
  } catch (error) {
    if (allowAnonymous) {
      console.error("Optional authentication failed:", error.message);
      return res.status(500).json({ message: "Unable to verify the optional session." });
    }
    return res.status(401).json({ message: "Invalid or expired session token. Please sign in again." });
  }
};

const requireAuth = (req, res, next) => authenticate(req, res, next);
const requireAuthAllowUnverified = (req, res, next) => authenticate(req, res, next, true);
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization?.startsWith("Bearer ")) return next();
  return authenticate(req, res, next, true, true);
};

const requireMentor = (req, res, next) => {
  if (!req.user || req.user.role !== "mentor") {
    return res.status(403).json({ message: "Only clinician mentors can publish case studies." });
  }
  if (req.user.mentorVerificationStatus !== "verified") {
    return res.status(403).json({ message: "Your mentor credentials must be verified before you can publish case studies." });
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
  requireAuthAllowUnverified,
  optionalAuth,
  requireMentor,
  requireAdmin,
  JWT_SECRET,
};
