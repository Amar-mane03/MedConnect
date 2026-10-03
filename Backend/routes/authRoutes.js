const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { requireAuth, JWT_SECRET } = require("../middlewares/authMiddleware");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const credentialDirectory = path.join(__dirname, "..", "uploads", "credentials");
fs.mkdirSync(credentialDirectory, { recursive: true });

const credentialUpload = multer({
  storage: multer.diskStorage({
    destination: credentialDirectory,
    filename: (req, file, callback) => {
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, [".pdf", ".png", ".jpg", ".jpeg"].includes(path.extname(file.originalname).toLowerCase()));
  }
});

const sendVerificationEmail = async (user, token) => {
  if(!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/$/, "");
  const verificationLink = `${frontendUrl}/verify-email/${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "MedConnect - Verify your email",
    html: `<div style="font-family: Arial, sans-serif;"><h2>Verify your MedConnect email</h2><p>Hello ${user.name},</p><p>Confirm your email address to finish creating your account.</p><a href="${verificationLink}" style="display:inline-block;padding:12px 20px;background:#0D9488;color:white;text-decoration:none;border-radius:6px;">Verify email</a><p>This link expires in 24 hours.</p></div>`
  });

  return true;
};

//SIGN UP

router.post("/signup", async(req, res) =>{
  try{
    const{
          name, 
          email, 
          password, 
          specialty, 
          role,
          careerStage,
          goals,
          communicationPreference
        } = req.body;

    //check required fields
    if(!name || !email || !password){
      return res.status(400).json({
        message: "Please fill all fields"
      });
    }

    if(password.length < 8 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({
        message: "Password must be 8 characters and include a number and symbol"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    //checck is user already exists

    const existingUser = await User.findOne({email: normalizedEmail});

    if(existingUser){
      return res.status(400).json({
        message: "User already exists"
      });
    }

    //Hash password

    const hashedPassword = await bcrypt.hash(password, 10);

    //create user

    const requestedRole = ["mentor", "mentee", "admin"].includes(role) ? role : "mentee";
    const hasAdminSecret = Boolean(process.env.ADMIN_SECRET) && req.body.adminSecret === process.env.ADMIN_SECRET;
    const assignedRole = requestedRole === "admin" ? (hasAdminSecret ? "admin" : "mentee") : requestedRole;

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      specialty,
      role,
      careerStage,
      goals,
      communicationPreference,
      mentorVerificationStatus: role === "mentor" ? "pending" : "not_required",
      specialty: specialty || "",
      role: assignedRole,
      careerStage: careerStage || "",
      goals: goals || "",
      communicationPreference: communicationPreference || "",
      mentorVerificationStatus: assignedRole === "mentor" ? "pending" : (assignedRole === "admin" ? "verified" : "not_required"),
      emailVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString("hex"),
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000
    });

    let verificationEmailSent = false;
    try {
      verificationEmailSent = await sendVerificationEmail(user, user.emailVerificationToken);
    } catch(emailError) {
      console.error("Verification email error:", emailError.message);
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: verificationEmailSent
        ? "Account created successfully. Check your inbox to verify your email."
        : "Account created, but the verification email could not be sent. Configure EMAIL_USER and EMAIL_PASS, then resend it.",
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        specialty: user.specialty,
        role: user.role,
        mentorVerificationStatus: user.mentorVerificationStatus
      }
    });

  }catch(error){
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/google", async(req, res) => {
  try {
    const { credential, role = "mentee" } = req.body;

    if(!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google sign-in is not configured yet" });
    }

    if(!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if(!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ message: "Google account email is not verified" });
    }

    let user = await User.findOne({ googleId: payload.sub });
    if(!user) user = await User.findOne({ email: payload.email.toLowerCase() });

    if(!user) {
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        emailVerified: true,
        role,
        mentorVerificationStatus: role === "mentor" ? "pending" : "not_required"
      });
    } else {
      user.googleId = payload.sub;
      user.emailVerified = true;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        specialty: user.specialty,
        role: user.role,
        mentorVerificationStatus: user.mentorVerificationStatus
      }
    });
  } catch(error) {
    console.error("Google sign-in error:", error);
    res.status(401).json({ message: "Unable to verify Google account" });
  }
});

router.get("/verify-email/:token", async(req, res) => {
  try {
    const user = await User.findOne({
      emailVerificationToken: req.params.token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if(!user) {
      return res.status(400).json({ message: "Verification link is invalid or expired" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch(error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Unable to verify email" });
  }
});

router.post("/resend-verification", async(req, res) => {
  try {
    const normalizedEmail = (req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if(user && !user.emailVerified) {
      user.emailVerificationToken = crypto.randomBytes(32).toString("hex");
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();
      const emailSent = await sendVerificationEmail(user, user.emailVerificationToken);
      if(!emailSent) {
        return res.status(503).json({ message: "Verification email delivery is not configured. Please contact the administrator." });
      }
    }

    res.json({ message: "If an account needs verification, a new link has been sent." });
  } catch(error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Unable to resend verification email" });
  }
});

router.post("/onboarding", requireAuth, async(req, res) => {
  try {
    const { careerStage, goals, communicationPreference } = req.body;

    if(!careerStage || !goals || !communicationPreference) {
      return res.status(400).json({ message: "Please complete all onboarding fields" });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { careerStage, goals, communicationPreference },
      { new: true }
    );

    if(!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.json({ message: "Profile preferences saved" });
  } catch(error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Unable to save onboarding preferences" });
  }
});

router.post("/mentor-credentials", requireAuth, credentialUpload.single("credential"), async(req, res) => {
  try {
    if(!req.file) {
      return res.status(400).json({ message: "A credential file is required" });
    }

    if(req.user.role !== "mentor") {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "Only mentor accounts can upload credentials" });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user._id, role: "mentor" },
      { mentorCredentialPath: req.file.path, mentorVerificationStatus: "pending" },
      { new: true }
    );

    if(!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Mentor account not found" });
    }

    res.json({ message: "Credential uploaded for review" });
  } catch(error) {
    if(req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Credential upload error:", error);
    res.status(500).json({ message: "Unable to upload credentials" });
  }
});


//LOGIN

router.post("/login", async(req, res) => {
  try{
    const{email, password} = req.body;

    //check details
    if(!email|| !password){
      return res.status(400).json({
        message: "Please enter email and password"
      });
    }

    //find user

    const user = await User.findOne({email: email.trim().toLowerCase()});

    if(!user){
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if(!user.password){
      return res.status(401).json({
        message: "This account uses Google sign-in. Continue with Google instead."
      });
    }

    //compare password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if(!isPasswordCorrect){
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if(!user.emailVerified){
      return res.status(403).json({
        message: "Please verify your email before signing in."
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        specialty: user.specialty,
        role: user.role,
        careerStage: user.careerStage,
        mentorVerificationStatus: user.mentorVerificationStatus
      }
    });
  } catch(error) {
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
});

// GET Current Authenticated Profile
router.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: req.user
  });
});

//forgot-password

router.post("/forgot-password", async(req, res) =>{
  try{
    const{email} = req.body;

    if(!email){
      return res.status(400).json({
        message: "Please enter your email"
      });
    }

    const user = await User.findOne({email});

    //Don't reveal whether an email exists
    if(!user){
      return res.json({
        message: "If an account exist with this email, a reset link has been sent."
      });
    }

    //Generate secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    //Store token and expiration
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    //Email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth:{
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/$/, "");
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "MedConnect - Password Reset",
      html:`
        <div style="font-family: Arial, sans-serif;">
          <h2>MedConnect Password Reset</h2>

          <p>Hello ${user.name},</p>

          <p>
          We received a request to reset your MedConnect password.
          </p>

          <a
          href="${resetLink}"
          style="
          display:inline-block;
          padding:12px 20px;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          "
          >
          Reset Password
          </a>

          <p>
          This link will expire in 15 minutes.
          </p>

          <p>If you did not request this, you can safely ignore this email.
          </p>
          </div>
      `
    });

    res.json({
      message: "If an account exists with this email, a reset link has been sent."
    });

  }catch(error){
    console.error("Forgot password error:", error);

    res.status(500).json({
      message: "Unable to process password reset request"
    });
  }
});

//forgot password api

router.post("/reset-password/:token", async(req, res) =>{
  try{
    const{token} = req.params;
    const{password} = req.body;

    if(!password){
      return res.status(400).json({
        message:"Please enter a new password"
      });
    }

    if(password.length<6){
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {$gt: Date.now()}
    });

    if(!user){
      return res.status(400).json({
        message: "Reset link is invalid or has expired"
      });
    }

    //Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;

    //Invalidate the reset token
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.json({
      message: "Password reset successfully"
    });

  }catch(error){
    console.error("Reset password error:", error);

    res.status(400).json({
      message: "Unable to reset password"
    });
  }
})

module.exports = router;