const express = require("express");
const User = require("../models/user");
const MentorshipRequest = require("../models/MentorshipRequest");
const { requireAuth } = require("../middlewares/authMiddleware");
const { createNotification } = require("../utils/notificationHelper");

const router = express.Router();

// GET all mentors
router.get("/", requireAuth, async (req, res) => {
  try {
    const { specialty } = req.query;
    const query = { role: "mentor" };
    if (specialty && specialty !== "All") {
      query.specialty = new RegExp(`^${specialty.trim()}$`, "i");
    }

    const mentors = await User.find(query)
      .select("-password")
      .sort({ rating: -1 });

    res.json({
      mentors: mentors.map(m => ({
        id: m._id,
        _id: m._id,
        name: m.name,
        specialty: m.specialty || "General Medicine",
        hospital: m.hospital || m.institution || "",
        location: m.location || "",
        rating: m.rating || null,
        reviewsCount: m.reviewsCount ?? (m.reviews ? m.reviews.length : 0),
        initials: m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        verified: m.mentorVerificationStatus === "verified",
        verificationStatus: m.mentorVerificationStatus,
        experienceYears: m.experienceYears || null,
        activeMenteesCount: m.activeMenteesCount || 0,
        caseStudiesCount: m.caseStudiesCount || 0,
        areasOfInterest: m.areasOfInterest || [],
      })),
    });
  } catch (error) {
    console.error("Fetch mentors error:", error);
    res.status(500).json({ message: "Unable to load mentors directory." });
  }
});

// GET single mentor by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id).select("-password");
    if (!mentor) {
      return res.status(404).json({ message: "Mentor profile not found." });
    }

    res.json({
      mentor: {
        id: mentor._id,
        _id: mentor._id,
        name: mentor.name,
        specialty: mentor.specialty,
        subspecialty: mentor.subspecialty,
        hospital: mentor.hospital || mentor.institution || "",
        location: mentor.location || "",
        bio: mentor.bio || "",
        degrees: mentor.degrees || "",
        licenseNumber: mentor.licenseNumber || "",
        rating: mentor.rating || null,
        reviewsCount: mentor.reviewsCount ?? (mentor.reviews ? mentor.reviews.length : 0),
        initials: mentor.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        verified: mentor.mentorVerificationStatus === "verified",
        verificationStatus: mentor.mentorVerificationStatus,
        experienceYears: mentor.experienceYears || null,
        activeMenteesCount: mentor.activeMenteesCount || 0,
        caseStudiesCount: mentor.caseStudiesCount || 0,
        areasOfInterest: mentor.areasOfInterest || [],
        publications: mentor.publications || [],
        reviews: mentor.reviews || [],
      },
    });
  } catch (error) {
    console.error("Fetch mentor detail error:", error);
    res.status(500).json({ message: "Unable to load mentor profile." });
  }
});

// POST request mentorship from mentor
router.post("/:id/request", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentee") {
      return res.status(403).json({ message: "Only mentee accounts can request mentorship." });
    }

    const mentorId = req.params.id;
    const menteeId = req.user._id;

    if (mentorId === menteeId.toString()) {
      return res.status(400).json({ message: "You cannot request mentorship from yourself." });
    }

    const mentor = await User.findById(mentorId);
    if (!mentor || mentor.role !== "mentor") {
      return res.status(404).json({ message: "Mentor not found." });
    }

    const existing = await MentorshipRequest.findOne({ mentee: menteeId, mentor: mentorId });
    if (existing) {
      if (existing.status === "pending") {
        return res.json({ message: "Mentorship request is already pending.", request: existing });
      }
      if (existing.status === "accepted") {
        return res.json({ message: "You are already connected with this mentor.", request: existing });
      }
    }

    const newRequest = await MentorshipRequest.create({
      mentee: menteeId,
      mentor: mentorId,
      goals: req.body.goals || req.user.goals || "Clinical learning and guidance",
      note: req.body.note || "",
      status: "pending",
    });

    await createNotification(req.app.get("io"), {
      recipientId: mentor._id,
      actorId: menteeId,
      category: "mentorship",
      title: "New mentorship request",
      message: `${req.user.name} requested a mentorship connection.`,
      page: "mentor-profile",
      targetId: mentor._id,
    });

    res.status(201).json({
      message: `Mentorship request sent to ${mentor.name}.`,
      request: newRequest,
    });
  } catch (error) {
    console.error("Request mentorship error:", error);
    res.status(500).json({ message: "Unable to send mentorship request." });
  }
});

// GET current user's sent or received mentorship requests
router.get("/requests/mine", requireAuth, async (req, res) => {
  try {
    const isMentor = req.user.role === "mentor";
    const filter = isMentor ? { mentor: req.user._id } : { mentee: req.user._id };

    const requests = await MentorshipRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("mentee", "name email specialty careerStage goals")
      .populate("mentor", "name email specialty hospital rating mentorVerificationStatus");

    res.json({ requests });
  } catch (error) {
    console.error("Fetch requests error:", error);
    res.status(500).json({ message: "Unable to load mentorship applications." });
  }
});

// PATCH accept or decline mentorship request (Mentor only)
router.patch("/requests/:id", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'accepted' or 'declined'." });
    }

    const request = await MentorshipRequest.findOne({ _id: req.params.id, mentor: req.user._id });
    if (!request) {
      return res.status(404).json({ message: "Mentorship request not found." });
    }
    if (request.status !== "pending") {
      return res.status(409).json({ message: "This mentorship request has already been reviewed." });
    }

    request.status = status;
    await request.save();

    await createNotification(req.app.get("io"), {
      recipientId: request.mentee,
      actorId: req.user._id,
      category: "mentorship",
      title: `Mentorship request ${status}`,
      message: `${req.user.name} ${status} your mentorship request.`,
      page: "mentor-profile",
      targetId: request.mentor,
    });

    if (status === "accepted") {
      await User.findByIdAndUpdate(req.user._id, { $inc: { activeMenteesCount: 1 } });
    }

    res.json({
      message: `Mentorship request ${status}.`,
      request,
    });
  } catch (error) {
    console.error("Update request error:", error);
    res.status(500).json({ message: "Unable to update request status." });
  }
});

module.exports = router;
