const express = require("express");
const User = require("../models/user");
const CaseStudy = require("../models/CaseStudy");
const Comment = require("../models/Comment");
const ContentReport = require("../models/ContentReport");
const { requireAuth, requireAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

// All routes in this router require authentication and admin privileges
router.use(requireAuth, requireAdmin);

router.get("/reports", async (req, res) => {
  try {
    const reports = await ContentReport.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("reporter", "name email")
      .populate("caseId", "title specialty status");

    const formatted = await Promise.all(reports.map(async report => {
      const content = report.targetType === "case"
        ? report.caseId
        : await Comment.findById(report.targetId).select("text moderationStatus authorName");

      return {
        id: report._id,
        targetType: report.targetType,
        targetId: report.targetId,
        caseId: report.caseId?._id,
        caseTitle: report.caseId?.title || "Case unavailable",
        specialty: report.caseId?.specialty || "",
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
        reporter: report.reporter?.name || "Member",
        content: report.targetType === "comment" ? content?.text || "Comment unavailable" : content?.title || "Case unavailable",
      };
    }));

    res.json({ reports: formatted });
  } catch (error) {
    console.error("Load content reports error:", error);
    res.status(500).json({ message: "Unable to load moderation reports." });
  }
});

router.patch("/reports/:id", async (req, res) => {
  try {
    const { action } = req.body;
    if (!["dismiss", "hide"].includes(action)) {
      return res.status(400).json({ message: "Choose dismiss or hide." });
    }

    const report = await ContentReport.findOne({ _id: req.params.id, status: "pending" });
    if (!report) return res.status(404).json({ message: "Pending report not found." });

    if (action === "hide") {
      if (report.targetType === "case") {
        await CaseStudy.findByIdAndUpdate(report.targetId, { status: "flagged" });
      } else {
        await Comment.findByIdAndUpdate(report.targetId, { moderationStatus: "hidden" });
      }
    }

    report.status = action === "hide" ? "actioned" : "dismissed";
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    await report.save();

    res.json({ message: action === "hide" ? "Content hidden from the community." : "Report dismissed.", report });
  } catch (error) {
    console.error("Review content report error:", error);
    res.status(500).json({ message: "Unable to review report." });
  }
});

// GET platform telemetry & live stats
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingVerifications = await User.countDocuments({ mentorVerificationStatus: "pending" });
    const activeMentors = await User.countDocuments({ role: "mentor", mentorVerificationStatus: "verified" });
    const totalCases = await CaseStudy.countDocuments();
    const totalComments = await Comment.countDocuments();
    const flaggedContent = await CaseStudy.countDocuments({ status: "flagged" });

    const statsObj = {
      totalUsers,
      pendingVerifications,
      activeMentors,
      totalCases,
      totalComments,
      flaggedContent,
    };

    res.json({
      stats: statsObj,
      ...statsObj,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: "Unable to load system telemetry." });
  }
});

// GET pending doctor verifications
router.get("/verifications", async (req, res) => {
  try {
    const pendingDoctors = await User.find({
      role: "mentor",
      mentorVerificationStatus: { $in: ["pending", "verified", "rejected"] },
    }).sort({ createdAt: -1 });

    const formatted = pendingDoctors.map(doc => ({
      id: doc._id,
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      specialty: doc.specialty || "Specialty Registrar",
      license: doc.licenseNumber || "",
      licenseNumber: doc.licenseNumber || "",
      hospital: doc.hospital || doc.institution || "",
      institution: doc.hospital || doc.institution || "",
      careerStage: doc.careerStage || "",
      submitted: new Date(doc.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" }),
      status: doc.mentorVerificationStatus,
      docs: doc.mentorCredentialPath ? ["Credential upload"] : [],
      credentialFile: doc.mentorCredentialPath || null,
    }));

    res.json({ verifications: formatted });
  } catch (error) {
    console.error("Admin verifications error:", error);
    res.status(500).json({ message: "Unable to load verifications queue." });
  }
});

// PATCH approve or reject doctor credentials
router.patch("/verifications/:id", async (req, res) => {
  try {
    const { action } = req.body; // 'approved', 'verified' or 'rejected'
    if (!["approved", "verified", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approved' or 'rejected'." });
    }

    const verificationStatus = (action === "approved" || action === "verified") ? "verified" : "rejected";

    const doctor = await User.findByIdAndUpdate(
      req.params.id,
      { mentorVerificationStatus: verificationStatus },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }

    // Also update authorVerified on their published cases if any
    await CaseStudy.updateMany(
      { author: doctor._id },
      { authorVerified: action === "approved" }
    );

    res.json({
      message: `Doctor ${doctor.name} credentials ${action} successfully.`,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        mentorVerificationStatus: doctor.mentorVerificationStatus,
      },
    });
  } catch (error) {
    console.error("Update verification error:", error);
    res.status(500).json({ message: "Unable to update verification status." });
  }
});

// GET all users for governance
router.get("/users", async (req, res) => {
  try {
    const { search, role } = req.query;
    const query = {};

    if (role && role !== "All") {
      query.role = role.toLowerCase();
    }

    if (search && search.trim()) {
      query.$or = [
        { name: new RegExp(search.trim(), "i") },
        { email: new RegExp(search.trim(), "i") },
        { specialty: new RegExp(search.trim(), "i") },
      ];
    }

    const users = await User.find(query).select("-password").sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ message: "Unable to load users table." });
  }
});

// PATCH change user role or toggle ban
router.patch("/users/:id", async (req, res) => {
  try {
    const { role, isBanned } = req.body;
    const updates = {};
    if (role && ["mentee", "mentor", "admin"].includes(role)) {
      updates.role = role;
    }
    if (typeof isBanned === "boolean") {
      updates.isBanned = isBanned;
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
    res.json({ message: "User account updated successfully.", user: updated });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Unable to update user profile." });
  }
});

module.exports = router;
