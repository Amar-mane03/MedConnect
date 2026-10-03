const express = require("express");
const User = require("../models/user");
const MentorshipRequest = require("../models/MentorshipRequest");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

// GET all mentors
router.get("/", async (req, res) => {
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
        hospital: m.hospital || m.institution || "NHS Foundation Trust",
        location: m.location || "London, UK",
        rating: m.rating || 4.9,
        reviewsCount: m.reviewsCount || (m.reviews ? m.reviews.length : 12),
        initials: m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        verified: m.mentorVerificationStatus === "verified",
        verificationStatus: m.mentorVerificationStatus,
        experienceYears: m.experienceYears || 10,
        activeMenteesCount: m.activeMenteesCount || 5,
        caseStudiesCount: m.caseStudiesCount || 14,
        areasOfInterest: m.areasOfInterest || [],
      })),
    });
  } catch (error) {
    console.error("Fetch mentors error:", error);
    res.status(500).json({ message: "Unable to load mentors directory." });
  }
});

// GET single mentor by ID
router.get("/:id", async (req, res) => {
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
        hospital: mentor.hospital || mentor.institution || "NHS Foundation Trust",
        location: mentor.location || "London, UK",
        bio: mentor.bio || `${mentor.name} is an active clinical educator and mentor on MedConnect.`,
        degrees: mentor.degrees || "MBBS, MD, FRCP",
        licenseNumber: mentor.licenseNumber || "GMC #7284910",
        rating: mentor.rating || 4.9,
        reviewsCount: mentor.reviewsCount || (mentor.reviews ? mentor.reviews.length : 47),
        initials: mentor.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        verified: mentor.mentorVerificationStatus === "verified",
        verificationStatus: mentor.mentorVerificationStatus,
        experienceYears: mentor.experienceYears || 14,
        activeMenteesCount: mentor.activeMenteesCount || 32,
        caseStudiesCount: mentor.caseStudiesCount || 68,
        areasOfInterest: mentor.areasOfInterest.length ? mentor.areasOfInterest : ["Clinical Education", "Diagnostics", "Research"],
        publications: mentor.publications.length ? mentor.publications : [
          { title: "Clinical Reasoning in Acute Inpatient Admissions", journal: "BMJ", year: "2024" },
          { title: "Specialist Training Detours & Early Career Mentorship", journal: "Lancet Digital", year: "2023" }
        ],
        reviews: mentor.reviews.length ? mentor.reviews : [
          { author: "Dr. James Crawford", rating: 5, time: "Aug 2026", text: "Outstanding mentor. Incredibly structured, generous, and rigorous." },
          { author: "Emily Zhao (MS4)", rating: 5, time: "Jul 2026", text: "Helped me prepare thoroughly for my specialty rotation." }
        ],
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
router.get("/my/requests", requireAuth, async (req, res) => {
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

    request.status = status;
    await request.save();

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
