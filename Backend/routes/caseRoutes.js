const express = require("express");
const CaseStudy = require("../models/CaseStudy");
const Comment = require("../models/Comment");
const ContentReport = require("../models/ContentReport");
const User = require("../models/user");
const { requireAuth, requireMentor } = require("../middlewares/authMiddleware");
const { createNotification } = require("../utils/notificationHelper");

const router = express.Router();

// GET all cases (with optional specialty and text search)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { specialty, search, topic, from, to } = req.query;
    const query = { status: "published" };

    if (specialty && specialty !== "All") {
      query.specialty = new RegExp(`^${specialty.trim()}$`, "i");
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    if (topic && topic.trim()) {
      const escapedTopic = topic.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = ["title", "subspecialty", "preview", "diagnosis"].map(field => ({
        [field]: { $regex: escapedTopic, $options: "i" },
      }));
    }

    const createdAt = {};
    if (from) {
      const startDate = new Date(from);
      if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "Invalid start date." });
      createdAt.$gte = startDate;
    }
    if (to) {
      const endDate = new Date(to);
      if (Number.isNaN(endDate.getTime())) return res.status(400).json({ message: "Invalid end date." });
      endDate.setDate(endDate.getDate() + 1);
      createdAt.$lt = endDate;
    }
    if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;

    const cases = await CaseStudy.find(query)
      .sort({ createdAt: -1 })
      .populate("author", "name specialty role mentorVerificationStatus hospital");

    res.json({
      cases: cases.map(c => ({
        id: c._id,
        _id: c._id,
        title: c.title,
        specialty: c.specialty,
        subspecialty: c.subspecialty,
        author: c.authorName || c.author?.name || "Dr. Clinician",
        role: c.authorRole || c.author?.specialty || "Attending",
        verified: c.authorVerified ?? (c.author?.mentorVerificationStatus === "verified"),
        authorId: c.author?._id || c.author,
        upvotes: c.upvotesCount || c.upvotes?.length || 0,
        upvotedUsers: c.upvotes || [],
        comments: c.commentsCount || 0,
        preview: c.preview,
        timeAgo: formatTimeAgo(c.createdAt),
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch cases error:", error);
    res.status(500).json({ message: "Unable to load case studies." });
  }
});

router.get("/saved", requireAuth, async (req, res) => {
  res.json({ savedCaseIds: req.user.savedCaseStudies || [] });
});

// GET single case by ID with its comments
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const caseItem = await CaseStudy.findOne({ _id: req.params.id, status: "published" })
      .populate("author", "name specialty role mentorVerificationStatus hospital");

    if (!caseItem) {
      return res.status(404).json({ message: "Case study not found." });
    }

    const comments = await Comment.find({ caseId: caseItem._id, moderationStatus: { $ne: "hidden" } })
      .sort({ createdAt: -1 })
      .populate("author", "name role specialty mentorVerificationStatus");

    res.json({
      case: {
        id: caseItem._id,
        _id: caseItem._id,
        title: caseItem.title,
        specialty: caseItem.specialty,
        subspecialty: caseItem.subspecialty,
        author: caseItem.authorName || caseItem.author?.name,
        authorRole: caseItem.authorRole || caseItem.author?.specialty || "Consultant",
        authorVerified: caseItem.authorVerified ?? (caseItem.author?.mentorVerificationStatus === "verified"),
        authorInitials: caseItem.authorInitials,
        preview: caseItem.preview,
        ageRange: caseItem.ageRange,
        sex: caseItem.sex,
        presentingComplaint: caseItem.presentingComplaint,
        history: caseItem.history,
        investigations: caseItem.investigations,
        diagnosis: caseItem.diagnosis,
        treatment: caseItem.treatment,
        outcome: caseItem.outcome,
        learningPoints: caseItem.learningPoints,
        upvotes: caseItem.upvotesCount || caseItem.upvotes?.length || 0,
        upvotedUsers: caseItem.upvotes || [],
        commentsCount: comments.length,
        createdAt: caseItem.createdAt,
      },
      comments: comments.map(cm => ({
        id: cm._id,
        _id: cm._id,
        author: cm.authorName || cm.author?.name,
        role: cm.authorRole || cm.author?.specialty || "Clinician",
        verified: cm.authorVerified ?? (cm.author?.mentorVerificationStatus === "verified"),
        initials: cm.initials,
        text: cm.text,
        likes: cm.likesCount || cm.likes?.length || 0,
        likedUsers: cm.likes || [],
        time: formatTimeAgo(cm.createdAt),
        createdAt: cm.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch case detail error:", error);
    res.status(500).json({ message: "Unable to load case details." });
  }
});

// POST report a case or comment for administrator review
router.post("/:id/save", requireAuth, async (req, res) => {
  try {
    const caseItem = await CaseStudy.findOne({ _id: req.params.id, status: "published" }).select("_id");
    if (!caseItem) return res.status(404).json({ message: "Case study not found." });

    const savedIds = req.user.savedCaseStudies || [];
    const alreadySaved = savedIds.some(id => id.toString() === caseItem._id.toString());
    await User.findByIdAndUpdate(req.user._id, alreadySaved
      ? { $pull: { savedCaseStudies: caseItem._id } }
      : { $addToSet: { savedCaseStudies: caseItem._id } });

    res.json({ saved: !alreadySaved, caseId: caseItem._id });
  } catch (error) {
    console.error("Save case error:", error);
    res.status(500).json({ message: "Unable to update saved cases." });
  }
});

router.post("/:id/report", requireAuth, async (req, res) => {
  try {
    const { reason, details } = req.body;
    if (!reason || !["Patient privacy concern", "Harassment or abuse", "Potentially unsafe content", "Other"].includes(reason)) {
      return res.status(400).json({ message: "Choose a valid report reason." });
    }

    const caseItem = await CaseStudy.findOne({ _id: req.params.id, status: "published" });
    if (!caseItem) return res.status(404).json({ message: "Case study not found." });

    const existing = await ContentReport.findOne({
      reporter: req.user._id,
      targetType: "case",
      targetId: caseItem._id,
      status: "pending",
    });
    if (existing) return res.json({ message: "You have already reported this case.", report: existing });

    const report = await ContentReport.create({
      reporter: req.user._id,
      targetType: "case",
      targetId: caseItem._id,
      caseId: caseItem._id,
      reason,
      details: typeof details === "string" ? details.trim().slice(0, 1000) : "",
    });

    res.status(201).json({ message: "Report sent to the moderation team.", report });
  } catch (error) {
    console.error("Report case error:", error);
    res.status(500).json({ message: "Unable to submit report." });
  }
});

router.post("/:id/comments/:commentId/report", requireAuth, async (req, res) => {
  try {
    const { reason, details } = req.body;
    if (!reason || !["Patient privacy concern", "Harassment or abuse", "Potentially unsafe content", "Other"].includes(reason)) {
      return res.status(400).json({ message: "Choose a valid report reason." });
    }

    const [caseItem, comment] = await Promise.all([
      CaseStudy.findOne({ _id: req.params.id, status: "published" }),
      Comment.findOne({ _id: req.params.commentId, caseId: req.params.id, moderationStatus: { $ne: "hidden" } }),
    ]);
    if (!caseItem || !comment) return res.status(404).json({ message: "Discussion content not found." });

    const existing = await ContentReport.findOne({
      reporter: req.user._id,
      targetType: "comment",
      targetId: comment._id,
      status: "pending",
    });
    if (existing) return res.json({ message: "You have already reported this comment.", report: existing });

    const report = await ContentReport.create({
      reporter: req.user._id,
      targetType: "comment",
      targetId: comment._id,
      caseId: caseItem._id,
      reason,
      details: typeof details === "string" ? details.trim().slice(0, 1000) : "",
    });

    res.status(201).json({ message: "Report sent to the moderation team.", report });
  } catch (error) {
    console.error("Report comment error:", error);
    res.status(500).json({ message: "Unable to submit report." });
  }
});

// POST publish new case study (ONLY FOR MENTORS)
router.post("/", requireAuth, requireMentor, async (req, res) => {
  try {
    const {
      title,
      specialty,
      subspecialty,
      preview,
      ageRange,
      sex,
      presentingComplaint,
      history,
      investigations,
      diagnosis,
      treatment,
      outcome,
      learningPoints,
      deidentifiedConfirmed,
    } = req.body;

    const casePreview = preview || presentingComplaint;
    if (deidentifiedConfirmed !== true) {
      return res.status(400).json({ message: "Confirm that patient-identifying information has been removed before publishing." });
    }
    if (!title || !specialty || !casePreview) {
      return res.status(400).json({ message: "Title, specialty, and presenting complaint/preview are required." });
    }

    const newCase = await CaseStudy.create({
      title: title.trim(),
      specialty: specialty.trim(),
      subspecialty: subspecialty || "",
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.specialty || "Attending Consultant",
      authorVerified: req.user.mentorVerificationStatus === "verified",
      authorInitials: req.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      preview: casePreview.trim(),
      ageRange: ageRange || "30–39 years",
      sex: sex || "Female",
      presentingComplaint: presentingComplaint || preview,
      history: history || "",
      investigations: investigations || "",
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      outcome: outcome || "",
      learningPoints: Array.isArray(learningPoints) ? learningPoints : (learningPoints ? [learningPoints] : []),
      status: "published",
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { caseStudiesCount: 1 } });

    res.status(201).json({
      message: "Case study published successfully to the clinical community.",
      case: newCase,
    });
  } catch (error) {
    console.error("Publish case error:", error);
    res.status(500).json({ message: "Unable to publish case study." });
  }
});

// POST toggle upvote on a case
router.post("/:id/upvote", requireAuth, async (req, res) => {
  try {
    const caseItem = await CaseStudy.findById(req.params.id);
    if (!caseItem) return res.status(404).json({ message: "Case study not found." });

    const userIdStr = req.user._id.toString();
    const existingIndex = caseItem.upvotes.findIndex(id => id.toString() === userIdStr);

    let upvoted = false;
    if (existingIndex > -1) {
      caseItem.upvotes.splice(existingIndex, 1);
    } else {
      caseItem.upvotes.push(req.user._id);
      upvoted = true;
    }

    caseItem.upvotesCount = caseItem.upvotes.length;
    await caseItem.save();

    res.json({
      upvoted,
      isUpvoted: upvoted,
      upvotes: caseItem.upvotesCount,
      upvotesCount: caseItem.upvotesCount,
    });
  } catch (error) {
    console.error("Upvote error:", error);
    res.status(500).json({ message: "Unable to update upvote." });
  }
});

// POST add comment to a case
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text cannot be empty." });
    }

    const caseItem = await CaseStudy.findById(req.params.id);
    if (!caseItem) return res.status(404).json({ message: "Case study not found." });

    const initials = req.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

    const comment = await Comment.create({
      caseId: caseItem._id,
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.careerStage || req.user.specialty || (req.user.role === "mentor" ? "Attending" : "Resident"),
      authorVerified: req.user.mentorVerificationStatus === "verified",
      initials,
      text: text.trim(),
    });

    caseItem.commentsCount = await Comment.countDocuments({ caseId: caseItem._id });
    await caseItem.save();

    await createNotification(req.app.get("io"), {
      recipientId: caseItem.author,
      actorId: req.user._id,
      category: "caseComments",
      title: "New case reply",
      message: `${req.user.name} added a reply to your case.`,
      page: "case-detail",
      targetId: caseItem._id,
    });

    res.status(201).json({
      message: "Comment posted to peer discussion.",
      comment: {
        id: comment._id,
        _id: comment._id,
        author: comment.authorName,
        role: comment.authorRole,
        verified: comment.authorVerified,
        initials: comment.initials,
        text: comment.text,
        likes: 0,
        time: "Just now",
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Unable to post comment." });
  }
});

// POST toggle like on comment
router.post("/:id/comments/:commentId/like", requireAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });

    const userIdStr = req.user._id.toString();
    const existingIndex = comment.likes.findIndex(id => id.toString() === userIdStr);

    let liked = false;
    if (existingIndex > -1) {
      comment.likes.splice(existingIndex, 1);
    } else {
      comment.likes.push(req.user._id);
      liked = true;
    }

    comment.likesCount = comment.likes.length;
    await comment.save();

    res.json({
      liked,
      isLiked: liked,
      likes: comment.likesCount,
      likesCount: comment.likesCount,
    });
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ message: "Unable to update like." });
  }
});

function formatTimeAgo(date) {
  if (!date) return "Recently";
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

module.exports = router;
