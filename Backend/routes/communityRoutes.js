const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const NGO = require("../models/NGO");
const Camp = require("../models/Camp");
const CampApplication = require("../models/CampApplication");
const CampReport = require("../models/CampReport");
const CampAnnouncement = require("../models/CampAnnouncement");
const CampQuestion = require("../models/CampQuestion");
const User = require("../models/user");
const Notification = require("../models/Notification");
const createTextPdf = require("../utils/textPdf");
const { requireAuth, requireAdmin, optionalAuth } = require("../middlewares/authMiddleware");

const router = express.Router();
const studentRoles = ["student", "mentee"];

// ─── Multer for NGO verification docs ────────────────────────────────────────
const privateUploadRoot = path.join(__dirname, "..", "private_uploads");
const privateDocumentTypes = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".png", new Set(["image/png"])],
]);

function privateDocumentUpload(folder) {
  const destination = path.join(privateUploadRoot, folder);
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const storage = multer.diskStorage({
    destination,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  });
  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (privateDocumentTypes.get(ext)?.has(file.mimetype)) cb(null, true);
      else cb(new Error("Only PDF, JPG, and PNG documents are accepted."));
    },
  });
}

const uploadNgoDoc = privateDocumentUpload("ngo-documents");
const uploadConsentDoc = privateDocumentUpload("consent-documents");

function handleDocumentUpload(upload, fieldName) {
  return (req, res, next) => upload.single(fieldName)(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: error.message || "Unable to receive the document." });
  });
}

async function validDocumentSignature(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const bytes = Buffer.alloc(8);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf") return bytes.subarray(0, bytesRead).toString("ascii").startsWith("%PDF-");
    if (ext === ".png") return bytes.subarray(0, bytesRead).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (ext === ".jpg" || ext === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return false;
  } finally {
    await handle.close();
  }
}

function privateDocumentPath(folder, filename) {
  if (!filename || path.basename(filename) !== filename) return null;
  const root = path.resolve(privateUploadRoot, folder);
  const resolved = path.resolve(root, filename);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

// ─── Email transport helper ───────────────────────────────────────────────────
function createTransport() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY },
    });
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return null;
}

async function sendEmail(to, subject, html) {
  const transport = createTransport();
  if (!transport) {
    console.warn(`Email not sent to ${to}: outbound email is not configured.`);
    return false;
  }
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@goodneighbors.org";
  try {
    await transport.sendMail({ from, to, subject, html });
    return true;
  } catch (error) {
    console.error("Email send error:", error.message);
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Your account does not have permission for this action." });
    }
    next();
  };
}

function safeSearch(value) {
  return String(value || "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validId(value) {
  return mongoose.isValidObjectId(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function validWebUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function verifiedNGOForOwner(ownerId) {
  return NGO.findOne({ owner: ownerId, verificationStatus: "verified" });
}

function validCampCoordinates(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== "";
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== "";
  if (!hasLatitude && !hasLongitude) return true;
  if (!hasLatitude || !hasLongitude) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

async function syncReportEffects(report) {
  const camp = await Camp.findById(report.camp).select("startAt endAt");
  if (!camp) throw new Error("A report references a missing camp.");
  const volunteerHours = Math.round(((camp.endAt - camp.startAt) / 3600000) * 100) / 100;
  if (report.attendeeApplicationIds.length) {
    await CampApplication.updateMany(
      { _id: { $in: report.attendeeApplicationIds }, camp: report.camp, status: { $in: ["approved", "completed"] }, checkedInAt: { $ne: null } },
      { status: "completed", volunteerHours, completedAt: report.createdAt }
    );
  }
  const [impact] = await CampReport.aggregate([
    { $match: { ngo: new mongoose.Types.ObjectId(report.ngo.toString()) } },
    { $group: {
      _id: null,
      beneficiariesServed: { $sum: "$beneficiariesServed" },
      campsCompleted: { $sum: 1 },
      volunteersEngaged: { $sum: "$volunteersAttended" },
    } },
  ]);

  // Aggregate total verified hours from completed applications
  const [hoursResult] = await CampApplication.aggregate([
    { $match: { status: "completed" } },
    {
      $lookup: {
        from: "camps",
        localField: "camp",
        foreignField: "_id",
        as: "campData",
      },
    },
    { $unwind: "$campData" },
    { $match: { "campData.ngo": new mongoose.Types.ObjectId(report.ngo.toString()) } },
    { $group: { _id: null, totalHours: { $sum: "$volunteerHours" } } },
  ]);

  await NGO.updateOne(
    { _id: report.ngo },
    { $set: {
      beneficiariesServed: impact?.beneficiariesServed || 0,
      campsCompleted: impact?.campsCompleted || 0,
      volunteersEngaged: impact?.volunteersEngaged || 0,
      totalVerifiedHours: hoursResult?.totalHours || 0,
    } }
  );
  return CampReport.findById(report._id)
    .populate("camp", "title causeCategory startAt endAt venue")
    .populate("ngo", "name location logoUrl")
    .populate({ path: "attendeeApplicationIds", populate: { path: "student", select: "name email" } });
}

function formatCamp(camp, applied = false, waitlisted = false) {
  return {
    id: camp._id,
    title: camp.title,
    causeCategory: camp.causeCategory,
    description: camp.description,
    startAt: camp.startAt,
    endAt: camp.endAt,
    venue: camp.venue,
    latitude: camp.latitude ?? null,
    longitude: camp.longitude ?? null,
    capacity: camp.capacity,
    applicationsCount: camp.applicationsCount,
    prerequisiteSkills: camp.prerequisiteSkills,
    isApplied: applied,
    isWaitlisted: waitlisted,
    isDemo: camp.isDemo === true,
    ngo: camp.ngo ? {
      id: camp.ngo._id,
      name: camp.ngo.name,
      logoUrl: camp.ngo.logoUrl,
      location: camp.ngo.location,
    } : undefined,
  };
}

function formatApplication(application) {
  const camp = application.camp;
  return {
    id: application._id,
    status: application.status,
    statement: application.statement,
    volunteerHours: application.volunteerHours,
    createdAt: application.createdAt,
    completedAt: application.completedAt,
    badgeIssued: application.badgeIssued || false,
    checkedInAt: application.checkedInAt || null,
    consentStatus: application.consentStatus || "not_required",
    waitlistPosition: application.waitlistPosition || null,
    student: application.student ? {
      id: application.student._id,
      name: application.student.name,
      email: application.student.email,
    } : undefined,
    camp: camp ? {
      id: camp._id,
      title: camp.title,
      causeCategory: camp.causeCategory,
      startAt: camp.startAt,
      endAt: camp.endAt,
      venue: camp.venue,
      ngo: camp.ngo?.name,
    } : undefined,
  };
}

async function createApplicationQr(application) {
  const token = crypto.randomBytes(32).toString("base64url");
  application.qrTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  application.qrCode = await QRCode.toDataURL(JSON.stringify({ token }), { width: 300, margin: 2 });
  return token;
}

async function reserveApplicationOrWaitlist(camp, application) {
  const reserved = await Camp.findOneAndUpdate(
    { _id: camp._id, $expr: { $lt: ["$applicationsCount", "$capacity"] } },
    { $inc: { applicationsCount: 1 } },
    { new: true }
  );
  if (reserved) {
    application.status = "pending";
    application.waitlistPosition = null;
    await application.save();
    return false;
  }
  const last = await CampApplication.findOne({ camp: camp._id, status: "waitlisted" }).sort({ waitlistPosition: -1, createdAt: -1 }).select("waitlistPosition");
  application.status = "waitlisted";
  application.waitlistPosition = (last?.waitlistPosition || 0) + 1;
  await application.save();
  return true;
}

async function promoteWaitlistedApplication(campId) {
  const camp = await Camp.findById(campId);
  if (!camp) return null;
  const application = await CampApplication.findOneAndUpdate(
    { camp: campId, status: "waitlisted" },
    { $set: { status: "approved", waitlistPosition: null }, $unset: { qrCode: "", qrTokenHash: "" } },
    { sort: { waitlistPosition: 1, createdAt: 1 }, new: true }
  ).populate("student", "name email");
  if (!application) return null;

  const reserved = await Camp.findOneAndUpdate(
    { _id: campId, $expr: { $lt: ["$applicationsCount", "$capacity"] } },
    { $inc: { applicationsCount: 1 } },
    { new: true }
  );
  if (!reserved) {
    application.status = "waitlisted";
    await application.save();
    return null;
  }

  application.status = "approved";
  await createApplicationQr(application);
  await application.save();
  const remaining = await CampApplication.find({ camp: campId, status: "waitlisted" }).sort({ waitlistPosition: 1, createdAt: 1 });
  await Promise.all(remaining.map((item, index) => CampApplication.updateOne({ _id: item._id }, { waitlistPosition: index + 1 })));
  await Notification.create({
    recipient: application.student._id,
    category: "community",
    title: "A camp spot is available",
    message: `You have been promoted from the waitlist for ${camp.title}.`,
    page: "camps",
    targetId: campId.toString(),
  });
  return application;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC NGO DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/demo-status", async (req, res) => {
  try {
    const [demoNGO, demoCamp] = await Promise.all([
      NGO.exists({ isDemo: true }),
      Camp.exists({ isDemo: true }),
    ]);
    res.json({ demoMode: Boolean(demoNGO || demoCamp) });
  } catch (error) {
    console.error("Load demo status error:", error);
    res.status(500).json({ message: "Unable to determine whether demo data is active." });
  }
});

router.get("/ngos", async (req, res) => {
  try {
    const query = { verificationStatus: "verified" };
    const search = safeSearch(req.query.search);
    const cause = String(req.query.cause || "").trim();
    const location = safeSearch(req.query.location);
    if (search) query.$or = [{ name: new RegExp(search, "i") }, { mission: new RegExp(search, "i") }, { causeTags: new RegExp(search, "i") }];
    if (cause && cause !== "All causes") query.causeTags = cause;
    if (location) query.location = new RegExp(location, "i");

    const ngos = await NGO.find(query).select("-owner -__v -verificationDocPath").sort({ name: 1 }).limit(100);
    res.json({ ngos, demoMode: ngos.some((ngo) => ngo.isDemo) });
  } catch (error) {
    console.error("Load public NGO directory error:", error);
    res.status(500).json({ message: "Unable to load the NGO directory." });
  }
});

router.get("/ngos/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid NGO identifier." });
  try {
    const ngo = await NGO.findOne({ _id: req.params.id, verificationStatus: "verified" }).select("-owner -__v -verificationDocPath");
    if (!ngo) return res.status(404).json({ message: "Verified NGO not found." });
    const camps = await Camp.find({ ngo: ngo._id, isPublished: true, endAt: { $gte: new Date() } }).sort({ startAt: 1 }).limit(20);
    res.json({ ngo, activeCamps: camps.map((camp) => formatCamp(camp)) });
  } catch (error) {
    console.error("Load NGO detail error:", error);
    res.status(500).json({ message: "Unable to load the NGO profile." });
  }
});

router.get("/ngos/:id/impact", async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid NGO identifier." });
  try {
    const ngo = await NGO.findOne({ _id: req.params.id, verificationStatus: "verified" }).select("_id");
    if (!ngo) return res.status(404).json({ message: "Verified NGO not found." });
    const [impact] = await CampReport.aggregate([
      { $match: { ngo: ngo._id } },
      { $group: { _id: null, beneficiaries: { $sum: "$beneficiariesServed" }, camps: { $sum: 1 } } },
    ]);
    const [hours] = await CampApplication.aggregate([
      { $match: { status: "completed" } },
      { $lookup: { from: "camps", localField: "camp", foreignField: "_id", as: "camp" } },
      { $unwind: "$camp" },
      { $match: { "camp.ngo": ngo._id } },
      { $group: { _id: null, total: { $sum: "$volunteerHours" } } },
    ]);
    res.json({ beneficiaries: impact?.beneficiaries || 0, camps: impact?.camps || 0, verifiedHours: hours?.total || 0 });
  } catch (error) {
    console.error("Load public NGO impact error:", error);
    res.status(500).json({ message: "Unable to load NGO impact statistics." });
  }
});

router.post("/ngos", requireAuth, requireRole("ngo"), async (req, res) => {
  try {
    const { name, mission, logoUrl = "", causeTags = [], location, website = "", campaigns = [] } = req.body;
    if (typeof name !== "string" || !name.trim() || typeof mission !== "string" || !mission.trim() || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ message: "Organization name, mission, and location are required." });
    }
    if (!validWebUrl(logoUrl) || !validWebUrl(website)) return res.status(400).json({ message: "Logo and website must use a valid http or https URL." });
    if (!Array.isArray(causeTags) || causeTags.length > 12 || !Array.isArray(campaigns) || campaigns.length > 20) {
      return res.status(400).json({ message: "Provide up to 12 causes and 20 campaigns." });
    }
    const existing = await NGO.findOne({ owner: req.user._id });
    if (existing) return res.status(409).json({ message: "Your account already has an NGO profile. Edit that profile instead." });

    const ngo = await NGO.create({
      owner: req.user._id,
      name: name.trim(),
      mission: mission.trim(),
      logoUrl,
      causeTags: causeTags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean),
      location: location.trim(),
      website,
      campaigns: campaigns.filter((campaign) => campaign && typeof campaign.title === "string" && campaign.title.trim()).map((campaign) => ({
        title: campaign.title.trim(),
        description: typeof campaign.description === "string" ? campaign.description.trim() : "",
        status: campaign.status === "completed" ? "completed" : "active",
      })),
    });
    res.status(201).json({ ngo, message: "NGO profile submitted for administrator verification." });
  } catch (error) {
    console.error("Create NGO profile error:", error);
    res.status(500).json({ message: "Unable to submit the NGO profile." });
  }
});

router.put("/ngos/:id", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid NGO identifier." });
  try {
    const { name, mission, logoUrl = "", causeTags = [], location, website = "", campaigns = [] } = req.body;
    if (typeof name !== "string" || !name.trim() || typeof mission !== "string" || !mission.trim() || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ message: "Organization name, mission, and location are required." });
    }
    if (!validWebUrl(logoUrl) || !validWebUrl(website)) return res.status(400).json({ message: "Logo and website must use a valid http or https URL." });
    if (!Array.isArray(causeTags) || causeTags.length > 12 || !Array.isArray(campaigns) || campaigns.length > 20) {
      return res.status(400).json({ message: "Provide up to 12 causes and 20 campaigns." });
    }
    const ngo = await NGO.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      {
        name: name.trim(),
        mission: mission.trim(),
        logoUrl,
        causeTags: causeTags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean),
        location: location.trim(),
        website,
        campaigns: campaigns.filter((campaign) => campaign && typeof campaign.title === "string" && campaign.title.trim()).map((campaign) => ({
          title: campaign.title.trim(),
          description: typeof campaign.description === "string" ? campaign.description.trim() : "",
          status: campaign.status === "completed" ? "completed" : "active",
        })),
        verificationStatus: "pending",
        verifiedAt: null,
      },
      { new: true, runValidators: true }
    );
    if (!ngo) return res.status(404).json({ message: "NGO profile not found for this account." });
    res.json({ ngo, message: "NGO profile updated and returned to the verification queue." });
  } catch (error) {
    console.error("Update NGO profile error:", error);
    res.status(500).json({ message: "Unable to update the NGO profile." });
  }
});

// ─── Layer 1a: NGO document upload ───────────────────────────────────────────
router.post("/ngo/upload-doc", requireAuth, requireRole("ngo"), handleDocumentUpload(uploadNgoDoc, "document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "A PDF, JPG, or PNG document file is required." });
    if (!await validDocumentSignature(req.file)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: "The selected file does not match its PDF, JPG, or PNG file type." });
    }
    const ngo = await NGO.findOne({ owner: req.user._id });
    if (!ngo) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ message: "NGO profile not found. Create your profile first." });
    }
    const previousPath = privateDocumentPath("ngo-documents", ngo.verificationDocPath);
    ngo.verificationDocPath = req.file.filename;
    ngo.verificationDocStatus = "pending_review";
    await ngo.save();
    if (previousPath && previousPath !== req.file.path) await fs.promises.unlink(previousPath).catch((error) => {
      if (error.code !== "ENOENT") console.error("Remove previous NGO verification document error:", error.message);
    });
    res.json({ message: "Verification document uploaded securely. An administrator will review it.", docUploaded: true, verificationDocStatus: ngo.verificationDocStatus });
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error("NGO doc upload error:", error);
    res.status(500).json({ message: "Unable to upload the verification document." });
  }
});

router.get("/admin/ngos/:id/document", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid NGO identifier." });
  try {
    const ngo = await NGO.findById(req.params.id).select("verificationDocPath name");
    const documentPath = privateDocumentPath("ngo-documents", ngo?.verificationDocPath);
    if (!documentPath || !fs.existsSync(documentPath)) return res.status(404).json({ message: "No verification document is available." });
    res.download(documentPath, `${ngo._id}-verification-document${path.extname(documentPath)}`);
  } catch (error) {
    console.error("Download NGO verification document error:", error);
    res.status(500).json({ message: "Unable to retrieve the verification document." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPS — PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/camps", optionalAuth, async (req, res) => {
  try {
    const past = req.query.filter === "past";
    const query = { isPublished: true, endAt: past ? { $lt: new Date() } : { $gte: new Date() } };
    const cause = String(req.query.cause || "").trim();
    const search = safeSearch(req.query.search);
    if (cause && cause !== "All causes") query.causeCategory = cause;
    if (search) query.$or = [{ title: new RegExp(search, "i") }, { description: new RegExp(search, "i") }, { venue: new RegExp(search, "i") }];

    const camps = await Camp.find(query).populate({ path: "ngo", match: { verificationStatus: "verified" }, select: "name logoUrl location" })
      .sort({ startAt: past ? -1 : 1 }).limit(100);
    const visibleCamps = camps.filter((camp) => camp.ngo);

    let appliedCampIds = new Set();
    let waitlistedCampIds = new Set();
    if (req.user && studentRoles.includes(req.user.role)) {
      const applications = await CampApplication.find({ student: req.user._id }).select("camp status");
      appliedCampIds = new Set(applications.filter(a => a.status !== "waitlisted").map((a) => a.camp.toString()));
      waitlistedCampIds = new Set(applications.filter(a => a.status === "waitlisted").map((a) => a.camp.toString()));
    }
    res.json({
      camps: visibleCamps.map((camp) => formatCamp(camp, appliedCampIds.has(camp._id.toString()), waitlistedCampIds.has(camp._id.toString()))),
      demoMode: visibleCamps.some((camp) => camp.isDemo),
    });
  } catch (error) {
    console.error("Load public camps error:", error);
    res.status(500).json({ message: "Unable to load camps." });
  }
});

// ─── Layer 2c: Get Q&A for a camp ────────────────────────────────────────────
router.get("/camps/:id/qa", optionalAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const camp = await Camp.findOne({ _id: req.params.id, isPublished: true })
      .populate({ path: "ngo", match: { verificationStatus: "verified" }, select: "owner" });
    if (!camp?.ngo) return res.status(404).json({ message: "Camp not found." });
    const questions = await CampQuestion.find({ camp: req.params.id })
      .sort({ createdAt: -1 }).limit(100);
    res.json({ questions: questions.map((question) => ({
      id: question._id,
      authorName: question.authorName,
      body: question.body,
      createdAt: question.createdAt,
      replies: question.replies.map((reply) => ({ authorName: reply.authorName, authorRole: reply.authorRole, body: reply.body, createdAt: reply.createdAt })),
    })) });
  } catch (error) {
    console.error("Load camp Q&A error:", error);
    res.status(500).json({ message: "Unable to load the Q&A thread." });
  }
});

// ─── Layer 2c: Post a question ────────────────────────────────────────────────
router.post("/camps/:id/qa", requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const camp = await Camp.findOne({ _id: req.params.id, isPublished: true });
    if (!camp) return res.status(404).json({ message: "Camp not found." });
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 2000) return res.status(400).json({ message: "Question must be 1–2000 characters." });
    const ngo = await NGO.findOne({ _id: camp.ngo, verificationStatus: "verified" }).select("owner");
    const isCampHost = ngo?.owner.toString() === req.user._id.toString();
    const isVolunteer = await CampApplication.exists({ camp: camp._id, student: req.user._id, status: { $in: ["approved", "completed"] } });
    if (!isCampHost && !isVolunteer) return res.status(403).json({ message: "Only the host organization and approved volunteers can post camp questions." });
    const question = await CampQuestion.create({
      camp: camp._id,
      author: req.user._id,
      authorName: req.user.name,
      body,
    });
    res.status(201).json({ question, message: "Question posted." });
  } catch (error) {
    console.error("Post camp question error:", error);
    res.status(500).json({ message: "Unable to post the question." });
  }
});

// ─── Layer 2c: Reply to a question (NGO or admin) ────────────────────────────
router.post("/camps/:id/qa/:qid/reply", requireAuth, requireRole("ngo", "admin"), async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.qid)) return res.status(400).json({ message: "Invalid identifier." });
  try {
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (!body || body.length > 2000) return res.status(400).json({ message: "Reply must be 1–2000 characters." });
    const camp = await Camp.findById(req.params.id).select("ngo");
    if (!camp) return res.status(404).json({ message: "Camp not found." });
    if (req.user.role === "ngo") {
      const ngo = await NGO.findOne({ _id: camp.ngo, owner: req.user._id, verificationStatus: "verified" }).select("_id");
      if (!ngo) return res.status(403).json({ message: "Only the host NGO can reply to this camp's questions." });
    }
    const question = await CampQuestion.findOneAndUpdate(
      { _id: req.params.qid, camp: req.params.id },
      { $push: { replies: { author: req.user._id, authorName: req.user.name, authorRole: req.user.role, body } } },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found." });
    res.json({ question, message: "Reply posted." });
  } catch (error) {
    console.error("Reply to camp question error:", error);
    res.status(500).json({ message: "Unable to post the reply." });
  }
});

// ─── Layer 2a: QR scanner — NGO coordinator scans a volunteer ────────────────
router.post("/camps/:id/scan", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const ngo = await verifiedNGOForOwner(req.user._id);
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required." });
    const camp = await Camp.findOne({ _id: req.params.id, ngo: ngo._id });
    if (!camp) return res.status(404).json({ message: "Camp not found for your organization." });

    const token = typeof req.body.token === "string" ? req.body.token : "";
    if (token.length < 32 || token.length > 100) return res.status(400).json({ message: "Invalid volunteer QR code." });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();
    if (camp.startAt > now || camp.endAt < now) return res.status(409).json({ message: "Check-in is available only during the scheduled camp." });

    const application = await CampApplication.findOneAndUpdate(
      { camp: camp._id, status: "approved", qrTokenHash: tokenHash, checkedInAt: null },
      { badgeIssued: true, checkedInAt: now },
      { new: true }
    ).populate("student", "name email");

    if (!application) return res.status(404).json({ message: "QR code is invalid, belongs to another camp, or has already been checked in." });

    const volunteerHours = Math.round(((camp.endAt - camp.startAt) / 3600000) * 100) / 100;
    res.json({
      message: `✅ ${application.student?.name || "Volunteer"} checked in successfully!`,
      student: { name: application.student?.name, email: application.student?.email },
      badgeIssued: true,
      checkedInAt: application.checkedInAt,
      volunteerHoursPendingReport: volunteerHours,
    });
  } catch (error) {
    console.error("Camp QR scan error:", error);
    res.status(500).json({ message: "Unable to process QR check-in." });
  }
});

// ─── Layer 2b: Send announcement broadcast ───────────────────────────────────
router.post("/camps/:id/announce", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const ngo = await verifiedNGOForOwner(req.user._id);
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required to send announcements." });
    const camp = await Camp.findOne({ _id: req.params.id, ngo: ngo._id });
    if (!camp) return res.status(404).json({ message: "Camp not found for your organization." });

    const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    if (!subject || subject.length > 200) return res.status(400).json({ message: "Subject must be 1–200 characters." });
    if (!body || body.length > 3000) return res.status(400).json({ message: "Message body must be 1–3000 characters." });

    // Get all approved volunteers
    const approvedApplications = await CampApplication.find({ camp: camp._id, status: "approved" })
      .populate("student", "name email");

    const announcement = await CampAnnouncement.create({
      camp: camp._id,
      ngo: ngo._id,
      sentBy: req.user._id,
      subject,
      body,
      recipientCount: approvedApplications.length,
    });

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
        <div style="background:#0B192C;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">${escapeHtml(ngo.name)}</h2>
          <p style="margin:4px 0 0;font-size:13px;opacity:0.8">Camp announcement: ${escapeHtml(camp.title)}</p>
        </div>
        <div style="padding:24px;border:1px solid #E1E7E5;border-top:none;border-radius:0 0 8px 8px">
          <h3 style="margin-top:0">${escapeHtml(subject)}</h3>
          <p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(body)}</p>
          <hr style="border-color:#E1E7E5;margin:20px 0">
          <p style="font-size:12px;color:#74817D">This announcement was sent to all approved volunteers for ${camp.title}.</p>
        </div>
      </div>`;

    const recipients = approvedApplications.map((application) => application.student).filter(Boolean);
    const notificationRecipients = await User.find({
      _id: { $in: recipients.map((recipient) => recipient._id) },
      "notificationPreferences.community": { $ne: false },
    }).select("_id");
    if (notificationRecipients.length) {
      await Notification.insertMany(notificationRecipients.map((recipient) => ({
        recipient: recipient._id,
        actor: req.user._id,
        category: "community",
        title: `Camp update: ${camp.title}`.slice(0, 120),
        message: subject.slice(0, 300),
        page: "camps",
        targetId: camp._id.toString(),
      })));
    }
    const emailConfigured = Boolean(createTransport());
    const emailResults = emailConfigured
      ? await Promise.all(recipients.filter((recipient) => recipient.email).map((recipient) => sendEmail(recipient.email, `[${camp.title}] ${subject}`, emailHtml)))
      : [];
    const emailCount = emailResults.filter(Boolean).length;

    res.status(201).json({
      announcement,
      message: `Announcement delivered in-app to ${notificationRecipients.length} approved volunteer${notificationRecipients.length !== 1 ? "s" : ""}${emailConfigured ? `; email sent to ${emailCount} of ${approvedApplications.length}.` : "; email is not configured."}`,
      recipientCount: approvedApplications.length,
      notifiedInApp: notificationRecipients.length,
      emailed: emailCount,
      emailConfigured,
    });
  } catch (error) {
    console.error("Camp announcement error:", error);
    res.status(500).json({ message: "Unable to send the announcement." });
  }
});

// ─── Layer 2b: Get past announcements for a camp ─────────────────────────────
router.get("/camps/:id/announcements", requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const camp = await Camp.findById(req.params.id).select("ngo");
    if (!camp) return res.status(404).json({ message: "Camp not found." });
    if (req.user.role === "ngo") {
      const ngo = await NGO.findOne({ _id: camp.ngo, owner: req.user._id }).select("_id");
      if (!ngo) return res.status(403).json({ message: "Only the host NGO can view this announcement history." });
    } else if (req.user.role !== "admin" && !await CampApplication.exists({ camp: camp._id, student: req.user._id, status: { $in: ["approved", "completed"] } })) {
      return res.status(403).json({ message: "Announcements are available to approved volunteers." });
    }
    const announcements = await CampAnnouncement.find({ camp: req.params.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ announcements });
  } catch (error) {
    console.error("Load announcements error:", error);
    res.status(500).json({ message: "Unable to load announcements." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPS — NGO MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/camps", requireAuth, requireRole("ngo"), async (req, res) => {
  try {
    const ngo = await verifiedNGOForOwner(req.user._id);
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required to publish camps." });
    const { title, causeCategory, description = "", startAt, endAt, venue, capacity, prerequisiteSkills = [], latitude, longitude } = req.body;
    const start = new Date(startAt);
    const end = new Date(endAt);
    const numericCapacity = Number(capacity);
    if (typeof title !== "string" || !title.trim() || typeof causeCategory !== "string" || !causeCategory.trim() || typeof venue !== "string" || !venue.trim() || !startAt || !endAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start <= new Date()) {
      return res.status(400).json({ message: "Enter a title, cause, future start and end time, and venue." });
    }
    if (!Number.isInteger(numericCapacity) || numericCapacity < 1 || numericCapacity > 10000 || !Array.isArray(prerequisiteSkills) || prerequisiteSkills.length > 30) {
      return res.status(400).json({ message: "Capacity must be 1–10,000 and prerequisites must be a list of up to 30 skills." });
    }
    if (!validCampCoordinates(latitude, longitude)) return res.status(400).json({ message: "Enter both a valid latitude and longitude, or leave both blank." });
    const camp = await Camp.create({
      ngo: ngo._id,
      title: title.trim(),
      causeCategory: causeCategory.trim(),
      description: String(description).trim(),
      startAt: start,
      endAt: end,
      venue: venue.trim(),
      latitude: latitude === undefined || latitude === "" ? null : Number(latitude),
      longitude: longitude === undefined || longitude === "" ? null : Number(longitude),
      capacity: numericCapacity,
      prerequisiteSkills: prerequisiteSkills.filter((skill) => typeof skill === "string").map((skill) => skill.trim()).filter(Boolean),
    });
    res.status(201).json({ camp: formatCamp(await camp.populate("ngo", "name logoUrl location")), message: "Camp published." });
  } catch (error) {
    console.error("Create camp error:", error);
    res.status(500).json({ message: "Unable to publish this camp." });
  }
});

router.put("/camps/:id", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const ngo = await verifiedNGOForOwner(req.user._id);
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required to edit camps." });
    const camp = await Camp.findOne({ _id: req.params.id, ngo: ngo._id, startAt: { $gt: new Date() } });
    if (!camp) return res.status(404).json({ message: "Upcoming camp not found for this organization." });
    if (camp.applicationsCount > 0 && Number(req.body.capacity) < camp.applicationsCount) {
      return res.status(400).json({ message: "Capacity cannot be lower than the current application count." });
    }
    const { title, causeCategory, description = "", startAt, endAt, venue, capacity, prerequisiteSkills = [], latitude, longitude } = req.body;
    const start = new Date(startAt);
    const end = new Date(endAt);
    const numericCapacity = Number(capacity);
    if (typeof title !== "string" || !title.trim() || typeof causeCategory !== "string" || !causeCategory.trim() || typeof venue !== "string" || !venue.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start <= new Date() || !Number.isInteger(numericCapacity) || numericCapacity < 1 || numericCapacity > 10000 || numericCapacity < camp.applicationsCount || !Array.isArray(prerequisiteSkills) || prerequisiteSkills.length > 30) {
      return res.status(400).json({ message: "Camp details, future times, positive capacity, and prerequisites are required." });
    }
    if (!validCampCoordinates(latitude, longitude)) return res.status(400).json({ message: "Enter both a valid latitude and longitude, or leave both blank." });
    Object.assign(camp, {
      title: title.trim(),
      causeCategory: causeCategory.trim(),
      description: String(description).trim(),
      startAt: start,
      endAt: end,
      venue: venue.trim(),
      latitude: latitude === undefined || latitude === "" ? null : Number(latitude),
      longitude: longitude === undefined || longitude === "" ? null : Number(longitude),
      capacity: numericCapacity,
      prerequisiteSkills: prerequisiteSkills.filter((skill) => typeof skill === "string").map((skill) => skill.trim()).filter(Boolean),
    });
    await camp.save();
    res.json({ camp: formatCamp(await camp.populate("ngo", "name logoUrl location")), message: "Camp updated." });
  } catch (error) {
    console.error("Update camp error:", error);
    res.status(500).json({ message: "Unable to update this camp." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NGO DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/ngo/profile", requireAuth, requireRole("ngo"), async (req, res) => {
  try {
    const ngo = await NGO.findOne({ owner: req.user._id }).select("-verificationDocPath");
    res.json({ ngo });
  } catch (error) {
    console.error("Load NGO profile error:", error);
    res.status(500).json({ message: "Unable to load the NGO profile." });
  }
});

router.get("/ngo/camps", requireAuth, requireRole("ngo"), async (req, res) => {
  try {
    const ngo = await NGO.findOne({ owner: req.user._id });
    if (!ngo) return res.json({ ngo: null, camps: [] });
    const camps = await Camp.find({ ngo: ngo._id }).sort({ startAt: -1 }).limit(100);
    const reportedCampIds = new Set((await CampReport.find({ ngo: ngo._id }).distinct("camp")).map((id) => id.toString()));
    res.json({ ngo, camps: camps.map((camp) => ({ ...formatCamp(camp), hasReport: reportedCampIds.has(camp._id.toString()) })) });
  } catch (error) {
    console.error("Load NGO camps error:", error);
    res.status(500).json({ message: "Unable to load organization camps." });
  }
});

router.get("/ngo/applications", requireAuth, requireRole("ngo"), async (req, res) => {
  try {
    const ngo = await NGO.findOne({ owner: req.user._id });
    if (!ngo) return res.json({ applications: [] });
    const campIds = await Camp.find({ ngo: ngo._id }).distinct("_id");
    const applications = await CampApplication.find({ camp: { $in: campIds } })
      .populate({ path: "student", select: "name email" })
      .populate({ path: "camp", select: "title causeCategory startAt endAt venue", populate: { path: "ngo", select: "name" } })
      .sort({ createdAt: -1 }).limit(300);
    res.json({ applications: applications.map(formatApplication) });
  } catch (error) {
    console.error("Load camp applications error:", error);
    res.status(500).json({ message: "Unable to load camp applications." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/student/profile", requireAuth, requireRole(...studentRoles), async (req, res) => {
  const user = await User.findById(req.user._id).select("dateOfBirth");
  res.json({ dateOfBirth: user?.dateOfBirth || null });
});

router.patch("/student/profile", requireAuth, requireRole(...studentRoles), async (req, res) => {
  const dateOfBirth = new Date(req.body.dateOfBirth);
  if (!req.body.dateOfBirth || Number.isNaN(dateOfBirth.getTime()) || dateOfBirth >= new Date()) {
    return res.status(400).json({ message: "Enter a valid date of birth." });
  }
  try {
    if (await CampApplication.exists({ student: req.user._id })) {
      return res.status(409).json({ message: "Date of birth cannot be changed after submitting a camp application. Contact support if it is incorrect." });
    }
    await User.updateOne({ _id: req.user._id }, { $set: { dateOfBirth } });
    res.json({ dateOfBirth });
  } catch (error) {
    console.error("Update student date of birth error:", error);
    res.status(500).json({ message: "Unable to update your date of birth." });
  }
});

router.get("/consent/template.pdf", (req, res) => {
  const pdf = createTextPdf([
    "GOOD NEIGHBORS - PARENTAL / INSTITUTIONAL CONSENT",
    "",
    "Student volunteer consent form",
    "",
    "Student full name: ____________________________________________________",
    "Date of birth: ___________________  Camp / activity: ___________________",
    "Host organization: ____________________________________________________",
    "",
    "I am the parent / legal guardian / faculty coordinator of the student named",
    "above. I have reviewed the camp details and consent to the student's",
    "participation. I understand that the student should follow the host",
    "organization's safety instructions and camp rules.",
    "",
    "Parent / guardian / coordinator name: __________________________________",
    "Relationship / role: __________________________________________________",
    "Email or phone: _______________________________________________________",
    "Signature: ____________________________________  Date: _________________",
    "",
    "Please sign this form and upload a clear PDF, JPG, or PNG image with the",
    "student's camp application. Contact the host organization with questions.",
    "",
    "This form is a template and does not replace any additional institution or",
    "local requirements that may apply to the activity.",
  ]);
  res.status(200).type("application/pdf").set("Content-Disposition", 'attachment; filename="good-neighbors-consent-form.pdf"').send(pdf);
});

router.post("/camps/:id/applications", requireAuth, requireRole(...studentRoles), handleDocumentUpload(uploadConsentDoc, "consentDocument"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const statement = typeof req.body.statement === "string" ? req.body.statement.trim() : "";
    if (!statement || statement.length > 1500) return res.status(400).json({ message: "Write a volunteer statement of up to 1,500 characters." });

    const fullUser = await User.findById(req.user._id).select("dateOfBirth name email");
    if (!fullUser?.dateOfBirth && req.body.dateOfBirth) {
      const parsedDateOfBirth = new Date(req.body.dateOfBirth);
      if (Number.isNaN(parsedDateOfBirth.getTime()) || parsedDateOfBirth >= new Date()) {
        return res.status(400).json({ message: "Enter a valid date of birth." });
      }
      fullUser.dateOfBirth = parsedDateOfBirth;
      await fullUser.save();
    }
    if (!fullUser?.dateOfBirth) {
      return res.status(428).json({ requiresDateOfBirth: true, message: "Add your date of birth before applying so we can determine whether consent is needed." });
    }
    const isMinor = getAge(fullUser.dateOfBirth) < 18;
    const consentMethod = isMinor ? req.body.consentMethod : null;
    const guardianEmail = typeof req.body.guardianEmail === "string" ? req.body.guardianEmail.trim().toLowerCase() : "";

    if (isMinor && !consentMethod) {
      return res.status(202).json({ requiresConsent: true, message: "A parent or institutional coordinator must provide consent before this application can be reviewed." });
    }
    if (isMinor && consentMethod === "guardian_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
      return res.status(400).json({ message: "Enter a valid guardian or faculty coordinator email address." });
    }
    if (isMinor && !["guardian_email", "signed_document"].includes(consentMethod)) {
      return res.status(400).json({ message: "Choose email sign-off or upload a signed consent form." });
    }
    if (isMinor && consentMethod === "guardian_email" && !createTransport()) {
      return res.status(503).json({ message: "Guardian email sign-off is unavailable because outbound email is not configured. Download and upload the signed consent form instead." });
    }
    if (isMinor && consentMethod === "signed_document" && !req.file) {
      return res.status(400).json({ message: "Upload a signed PDF, JPG, or PNG consent form." });
    }
    if (req.file && !await validDocumentSignature(req.file)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: "The selected file does not match its PDF, JPG, or PNG file type." });
    }

    const camp = await Camp.findOne({ _id: req.params.id, isPublished: true, startAt: { $gt: new Date() } })
      .populate("ngo", "verificationStatus name");
    if (!camp) return res.status(404).json({ message: "Upcoming camp not found." });
    if (camp.ngo?.verificationStatus !== "verified") return res.status(404).json({ message: "Upcoming camp not found." });
    if (await CampApplication.exists({ camp: camp._id, student: req.user._id })) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ message: "You have already applied to this camp." });
    }

    const rawConsentToken = isMinor && consentMethod === "guardian_email" ? crypto.randomBytes(32).toString("base64url") : null;
    try {
      const application = await CampApplication.create({
        camp: camp._id,
        student: req.user._id,
        statement,
        status: isMinor ? "consent_pending" : "pending",
        guardianEmail: isMinor && consentMethod === "guardian_email" ? guardianEmail : null,
        consentStatus: !isMinor ? "not_required" : consentMethod === "guardian_email" ? "pending_email" : "pending_document_review",
        consentTokenHash: rawConsentToken ? crypto.createHash("sha256").update(rawConsentToken).digest("hex") : null,
        consentTokenExpiresAt: rawConsentToken ? new Date(Date.now() + 72 * 60 * 60 * 1000) : null,
        consentDocumentPath: req.file?.filename || null,
      });
      if (rawConsentToken) {
        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8443").trim().replace(/\/$/, "");
        const consentUrl = `${frontendUrl}/consent?token=${encodeURIComponent(rawConsentToken)}`;
        const sent = await sendEmail(
          guardianEmail,
          `Consent requested for ${camp.title}`,
          `<p>${escapeHtml(fullUser.name)} has requested your consent to volunteer at <strong>${escapeHtml(camp.title)}</strong>.</p><p><a href="${consentUrl}">Review and provide consent</a></p><p>This link expires in 72 hours. If you did not expect this request, you may ignore it.</p>`
        );
        if (!sent) {
          await CampApplication.deleteOne({ _id: application._id });
          return res.status(502).json({ message: "The consent request email could not be sent. Please try again or upload a signed consent form." });
        }
        return res.status(201).json({ application: formatApplication(application), message: "Consent request emailed to the guardian. Your camp application will enter review after they approve." });
      }
      if (isMinor) {
        return res.status(201).json({ application: formatApplication(application), message: "Signed consent form submitted for administrator review. Your camp application will enter review after approval." });
      }
      const waitlisted = await reserveApplicationOrWaitlist(camp, application);
      const populated = await application.populate([{ path: "student", select: "name email" }, { path: "camp", select: "title causeCategory startAt endAt venue", populate: { path: "ngo", select: "name" } }]);
      return res.status(201).json({
        application: formatApplication(populated),
        message: waitlisted ? `This camp is full. You have been added to waitlist position ${application.waitlistPosition}.` : "Your application was submitted.",
        waitlisted,
        waitlistPosition: application.waitlistPosition,
      });
    } catch (error) {
      if (error.code === 11000) {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(409).json({ message: "You have already applied to this camp." });
      }
      throw error;
    }
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error("Apply to camp error:", error);
    res.status(500).json({ message: "Unable to submit your application." });
  }
});

router.post("/consent/guardian/:token", async (req, res) => {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (token.length < 32 || token.length > 100) return res.status(400).json({ message: "Invalid consent link." });
  try {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const application = await CampApplication.findOne({
      consentTokenHash: hash,
      consentStatus: "pending_email",
      consentTokenExpiresAt: { $gt: new Date() },
      status: "consent_pending",
    }).populate("camp", "_id");
    if (!application) return res.status(410).json({ message: "This consent link is invalid, expired, or already used." });
    application.consentStatus = "approved";
    application.consentTokenHash = null;
    application.consentTokenExpiresAt = null;
    await reserveApplicationOrWaitlist(application.camp, application);
    const waitlisted = application.status === "waitlisted";
    return res.json({ message: waitlisted ? "Consent recorded. The student has been added to the camp waitlist." : "Consent recorded. The application is now awaiting NGO review.", waitlisted });
  } catch (error) {
    console.error("Guardian consent approval error:", error);
    res.status(500).json({ message: "Unable to record guardian consent." });
  }
});

router.get("/admin/consents", requireAuth, requireAdmin, async (req, res) => {
  try {
    const applications = await CampApplication.find({ consentStatus: "pending_document_review", status: "consent_pending" })
      .populate("student", "name email")
      .populate("camp", "title")
      .sort({ createdAt: 1 })
      .limit(100);
    res.json({ applications: applications.map((application) => ({
      id: application._id,
      student: application.student,
      camp: application.camp,
      submittedAt: application.createdAt,
      hasDocument: Boolean(application.consentDocumentPath),
    })) });
  } catch (error) {
    console.error("Load consent review queue error:", error);
    res.status(500).json({ message: "Unable to load the consent review queue." });
  }
});

router.get("/admin/consents/:id/document", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
  try {
    const application = await CampApplication.findById(req.params.id).select("+consentDocumentPath");
    const documentPath = privateDocumentPath("consent-documents", application?.consentDocumentPath);
    if (!documentPath || !fs.existsSync(documentPath)) return res.status(404).json({ message: "Signed consent form not found." });
    res.download(documentPath, `${application._id}-signed-consent${path.extname(documentPath)}`);
  } catch (error) {
    console.error("Download signed consent form error:", error);
    res.status(500).json({ message: "Unable to retrieve the signed consent form." });
  }
});

router.patch("/admin/consents/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id) || req.body.action !== "approve") return res.status(400).json({ message: "Choose approve for a valid application." });
  try {
    const application = await CampApplication.findOne({
      _id: req.params.id,
      status: "consent_pending",
      consentStatus: "pending_document_review",
    }).populate("camp", "_id title");
    if (!application) return res.status(404).json({ message: "Pending signed-consent submission not found." });
    application.consentStatus = "approved";
    await reserveApplicationOrWaitlist(application.camp, application);
    if (application.student) {
      await Notification.create({
        recipient: application.student,
        category: "community",
        title: "Consent approved",
        message: `Your consent form for ${application.camp.title} has been reviewed.`,
        page: "camps",
        targetId: application.camp._id.toString(),
      });
    }
    res.json({ message: application.status === "waitlisted" ? "Consent approved; the student was added to the waitlist." : "Consent approved; the application is awaiting NGO review." });
  } catch (error) {
    console.error("Approve signed consent form error:", error);
    res.status(500).json({ message: "Unable to approve the signed consent form." });
  }
});

// ─── Layer 3b: Student transcript data ───────────────────────────────────────
router.get("/activities/transcript", requireAuth, requireRole(...studentRoles), async (req, res) => {
  try {
    const applications = await CampApplication.find({ student: req.user._id, status: "completed" })
      .populate({ path: "camp", select: "title causeCategory description startAt endAt venue", populate: { path: "ngo", select: "name location" } })
      .sort({ completedAt: -1 });
    const totalHours = applications.reduce((total, a) => total + (a.volunteerHours || 0), 0);
    res.json({
      student: { name: req.user.name, email: req.user.email, institution: req.user.institution },
      completedCamps: applications.map(a => ({
        campTitle: a.camp?.title,
        campDescription: a.camp?.description,
        volunteerRole: a.statement,
        ngoName: a.camp?.ngo?.name,
        ngoLocation: a.camp?.ngo?.location,
        causeCategory: a.camp?.causeCategory,
        venue: a.camp?.venue,
        startAt: a.camp?.startAt,
        endAt: a.camp?.endAt,
        volunteerHours: a.volunteerHours,
        completedAt: a.completedAt,
        badgeIssued: a.badgeIssued,
      })),
      totalHours,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Transcript data error:", error);
    res.status(500).json({ message: "Unable to generate transcript data." });
  }
});

router.get("/activities/transcript.pdf", requireAuth, requireRole(...studentRoles), async (req, res) => {
  try {
    const applications = await CampApplication.find({ student: req.user._id, status: "completed" })
      .populate({ path: "camp", select: "title causeCategory description startAt endAt venue", populate: { path: "ngo", select: "name location" } })
      .sort({ completedAt: -1 });
    const totalHours = applications.reduce((total, application) => total + (application.volunteerHours || 0), 0);
    const lines = [
      "GOOD NEIGHBORS - VERIFIED VOLUNTEER TRANSCRIPT",
      "",
      `Student: ${req.user.name}`,
      `Email: ${req.user.email}`,
      req.user.institution ? `Institution: ${req.user.institution}` : "",
      `Verified volunteer hours: ${totalHours.toFixed(2)}`,
      `Completed camps: ${applications.length}`,
      `Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      "",
    ];
    applications.forEach((application, index) => {
      lines.push(`${index + 1}. ${application.camp?.title || "Camp"}`);
      lines.push(`Organization: ${application.camp?.ngo?.name || "Good Neighbors partner"}`);
      lines.push(`Service area: ${application.camp?.causeCategory || ""} | ${application.camp?.venue || ""}`);
      lines.push(`Date: ${application.camp?.startAt ? new Date(application.camp.startAt).toLocaleDateString("en-US") : "N/A"} | Verified hours: ${(application.volunteerHours || 0).toFixed(2)}`);
      lines.push(`Volunteer role / statement: ${application.statement}`);
      if (application.camp?.description) lines.push(`Camp description: ${application.camp.description}`);
      lines.push("");
    });
    lines.push("Official Good Neighbors record. Hours reflect attendance verified by the camp organizer and completed camp report.");
    const pdf = createTextPdf(lines);
    res.status(200).type("application/pdf").set("Content-Disposition", 'attachment; filename="good-neighbors-verified-transcript.pdf"').send(pdf);
  } catch (error) {
    console.error("Download verified transcript error:", error);
    res.status(500).json({ message: "Unable to generate your verified transcript." });
  }
});

// ─── Student activities list ──────────────────────────────────────────────────
router.get("/activities", requireAuth, requireRole(...studentRoles), async (req, res) => {
  try {
    const applications = await CampApplication.find({ student: req.user._id })
      .populate({ path: "camp", populate: { path: "ngo", select: "name" } })
      .sort({ createdAt: -1 }).limit(200);
    const formatted = applications.map(formatApplication);
    const totalHours = applications.reduce((total, application) => total + (application.volunteerHours || 0), 0);
    res.json({ applications: formatted, totalHours, completedCamps: applications.filter((application) => application.status === "completed").length });
  } catch (error) {
    console.error("Load student activities error:", error);
    res.status(500).json({ message: "Unable to load your activities." });
  }
});

// ─── Layer 2a: Get QR code for an approved application ───────────────────────
router.get("/applications/:id/qr", requireAuth, requireRole(...studentRoles), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
  try {
    const application = await CampApplication.findOne({ _id: req.params.id, student: req.user._id, status: "approved" }).select("+qrTokenHash");
    if (!application) return res.status(404).json({ message: "Approved application not found." });

    // Generate QR if not already done
    if (!application.qrCode || !application.qrTokenHash) {
      await createApplicationQr(application);
      await application.save();
    }
    res.json({ qrCode: application.qrCode, applicationId: application._id });
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ message: "Unable to generate your QR code." });
  }
});

// ─── Layer 2d: Approve or reject application (with waitlist promotion) ────────
router.patch("/applications/:id", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
  try {
    const { action } = req.body;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Choose approve or reject." });
    const ngo = await NGO.findOne({ owner: req.user._id, verificationStatus: "verified" });
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required to review applications." });
    const campIds = await Camp.find({ ngo: ngo._id }).distinct("_id");
    const application = await CampApplication.findOneAndUpdate(
      { _id: req.params.id, camp: { $in: campIds }, status: "pending" },
      { status: action === "approve" ? "approved" : "rejected" },
      { new: true }
    ).populate("student", "name email").populate("camp", "title causeCategory startAt endAt venue");
    if (!application) return res.status(404).json({ message: "Pending application not found for this organization." });

    if (action === "approve") {
      try {
        await createApplicationQr(application);
        await application.save();
      } catch (error) {
        application.status = "pending";
        await application.save();
        throw error;
      }

      await Notification.create({
        recipient: application.student._id,
        category: "community",
        title: "Camp application approved",
        message: `Your application for ${application.camp?.title} was approved. Your check-in QR code is ready.`,
        page: "camps",
        targetId: application.camp._id.toString(),
      });
      const emailHtml = `<p>Hi ${escapeHtml(application.student.name)},</p><p>Your application for <strong>${escapeHtml(application.camp?.title)}</strong> was approved. Sign in to Good Neighbors to view your private check-in QR code.</p>`;
      await sendEmail(application.student.email, `Application approved — ${application.camp?.title}`, emailHtml);
    }

    if (action === "reject") {
      await Camp.updateOne({ _id: application.camp._id, applicationsCount: { $gt: 0 } }, { $inc: { applicationsCount: -1 } });
      await promoteWaitlistedApplication(application.camp._id);
    }

    res.json({ application: formatApplication(application), message: `Application ${action === "approve" ? "approved" : "rejected"}.` });
  } catch (error) {
    console.error("Review camp application error:", error);
    res.status(500).json({ message: "Unable to review this application." });
  }
});

router.post("/applications/:id/cancel", requireAuth, requireRole(...studentRoles), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application identifier." });
  try {
    const application = await CampApplication.findOneAndUpdate(
      { _id: req.params.id, student: req.user._id, status: { $in: ["consent_pending", "pending", "approved", "waitlisted"] } },
      { $set: { status: "cancelled" }, $unset: { qrCode: "", qrTokenHash: "", consentTokenHash: "", consentTokenExpiresAt: "", waitlistPosition: "" } },
      { new: false }
    );
    if (!application) return res.status(404).json({ message: "An active camp application was not found." });
    const previousStatus = application.status;
    const wasWaitlisted = previousStatus === "waitlisted";
    if (["pending", "approved"].includes(previousStatus)) {
      await Camp.updateOne({ _id: application.camp, applicationsCount: { $gt: 0 } }, { $inc: { applicationsCount: -1 } });
      await promoteWaitlistedApplication(application.camp);
    } else if (wasWaitlisted) {
      const remaining = await CampApplication.find({ camp: application.camp, status: "waitlisted" }).sort({ waitlistPosition: 1, createdAt: 1 });
      await Promise.all(remaining.map((item, index) => CampApplication.updateOne({ _id: item._id }, { waitlistPosition: index + 1 })));
    }
    application.status = "cancelled";
    application.waitlistPosition = null;
    res.json({ application: formatApplication(application), message: "Your camp application was cancelled." });
  } catch (error) {
    console.error("Cancel camp application error:", error);
    res.status(500).json({ message: "Unable to cancel this camp application." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMP REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/camps/:id/report", requireAuth, requireRole("ngo"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const ngo = await NGO.findOne({ owner: req.user._id, verificationStatus: "verified" });
    if (!ngo) return res.status(403).json({ message: "A verified NGO profile is required to submit reports." });
    const camp = await Camp.findOne({ _id: req.params.id, ngo: ngo._id, endAt: { $lt: new Date() } });
    if (!camp) return res.status(404).json({ message: "A completed camp belonging to your organization is required." });
    const existingReport = await CampReport.findOne({ camp: camp._id });
    if (existingReport) {
      const populatedReport = await syncReportEffects(existingReport);
      return res.json({ report: populatedReport, message: "Impact report already generated; volunteer records are up to date." });
    }

    const beneficiariesServed = Number(req.body.beneficiariesServed);
    const volunteersAttended = Number(req.body.volunteersAttended);
    const notes = typeof req.body.successNotes === "string" ? req.body.successNotes.trim() : "";
    const rawResources = req.body.resourcesDistributed || {};
    const resourcesDistributed = {
      kits: Number(rawResources.kits ?? 0),
      medicines: Number(rawResources.medicines ?? 0),
      books: Number(rawResources.books ?? 0),
      other: Number(rawResources.other ?? 0),
    };
    const photoUrls = Array.isArray(req.body.photoUrls) ? req.body.photoUrls : [];
    const attendeeApplicationIds = Array.isArray(req.body.attendeeApplicationIds) ? req.body.attendeeApplicationIds : [];
    const numericValues = [beneficiariesServed, volunteersAttended, ...Object.values(resourcesDistributed)];
    if (numericValues.some((value) => !Number.isInteger(value) || value < 0) || !notes || notes.length > 5000) {
      return res.status(400).json({ message: "Beneficiary, volunteer, and resource metrics must be non-negative whole numbers, and success notes are required." });
    }
    if (photoUrls.length > 10 || photoUrls.some((url) => typeof url !== "string" || !validWebUrl(url)) || attendeeApplicationIds.length > camp.capacity || attendeeApplicationIds.some((id) => !validId(id))) {
      return res.status(400).json({ message: "Provide up to 10 valid photo URLs and valid camp participant IDs." });
    }
    const attendees = attendeeApplicationIds.length
      ? await CampApplication.find({ _id: { $in: attendeeApplicationIds }, camp: camp._id, status: "approved", checkedInAt: { $ne: null } }).populate("student", "name")
      : [];
    if (attendees.length !== new Set(attendeeApplicationIds.map(String)).size) {
      return res.status(400).json({ message: "Select only approved volunteers who have checked in for this camp." });
    }
    if (volunteersAttended < attendees.length) {
      return res.status(400).json({ message: "Volunteers attended cannot be fewer than the selected participating students." });
    }

    let report = await CampReport.findOne({ camp: camp._id });
    if (!report) {
      try {
        report = await CampReport.create({
          camp: camp._id, ngo: ngo._id, beneficiariesServed, volunteersAttended,
          resourcesDistributed, successNotes: notes, photoUrls, attendeeApplicationIds,
          submittedBy: req.user._id,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        report = await CampReport.findOne({ camp: camp._id });
        if (!report) throw error;
      }
    }
    const populatedReport = await syncReportEffects(report);
    res.status(201).json({ report: populatedReport, message: "Impact report generated and volunteer hours recorded." });
  } catch (error) {
    console.error("Submit camp report error:", error);
    res.status(500).json({ message: "Unable to generate the impact report." });
  }
});

router.get("/camps/:id/report", requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid camp identifier." });
  try {
    const report = await CampReport.findOne({ camp: req.params.id })
      .populate("camp", "title causeCategory startAt endAt venue")
      .populate("ngo", "name location logoUrl")
      .populate({ path: "attendeeApplicationIds", populate: { path: "student", select: "name email" } });
    if (!report) return res.status(404).json({ message: "Impact report not found." });
    const ngo = await NGO.findById(report.ngo._id).select("owner");
    const isAdmin = req.user.role === "admin";
    const isNGOOwner = ngo?.owner.toString() === req.user._id.toString();
    const isParticipatingStudent = await CampApplication.exists({ camp: report.camp._id, student: req.user._id, status: "completed" });
    if (!isAdmin && !isNGOOwner && !isParticipatingStudent) return res.status(403).json({ message: "You do not have permission to view this report." });
    res.json({ report });
  } catch (error) {
    console.error("Load camp report error:", error);
    res.status(500).json({ message: "Unable to load the impact report." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/ngos", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ngos = await NGO.find({ $or: [{ verificationStatus: "pending" }, { verificationDocStatus: "pending_review" }] }).select("-verificationDocPath").populate("owner", "name email").sort({ createdAt: 1 }).limit(100);
    const documents = await NGO.find({ verificationDocStatus: "pending_review" }).select("_id");
    const withDocumentIds = new Set(documents.map((ngo) => ngo._id.toString()));
    const ngosWithDocument = ngos.map((ngo) => ({ ...ngo.toObject(), hasVerificationDocument: withDocumentIds.has(ngo._id.toString()) }));
    res.json({ ngos: ngosWithDocument });
  } catch (error) {
    console.error("Load NGO verification queue error:", error);
    res.status(500).json({ message: "Unable to load the NGO verification queue." });
  }
});

router.patch("/admin/ngos/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid NGO identifier." });
  try {
    const { action } = req.body;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Choose approve or reject." });
    const ngo = await NGO.findOne({ _id: req.params.id, verificationStatus: "pending" }).select("+verificationDocPath");
    if (!ngo) return res.status(404).json({ message: "Pending NGO application not found." });
    ngo.verificationStatus = action === "approve" ? "verified" : "rejected";
    ngo.verifiedAt = action === "approve" ? new Date() : null;
    await ngo.save();
    await ngo.populate("owner", "name email");

    // Notify NGO owner by email
    if (ngo.owner?.email) {
      const subject = action === "approve" ? "Your NGO is now verified on Good Neighbors!" : "NGO verification update";
      const html = action === "approve"
        ? `<p>Hi ${ngo.owner.name},</p><p>Congratulations! <strong>${ngo.name}</strong> has been verified. You can now publish volunteer camps.</p>`
        : `<p>Hi ${ngo.owner.name},</p><p>Your NGO profile for <strong>${ngo.name}</strong> requires updates before verification. Please log in and revise your submission.</p>`;
      sendEmail(ngo.owner.email, subject, html).catch(() => {});
    }

    res.json({ ngo, message: `NGO ${action === "approve" ? "verified" : "rejected"}.` });
  } catch (error) {
    console.error("Review NGO verification error:", error);
    res.status(500).json({ message: "Unable to update the NGO verification status." });
  }
});

router.patch("/admin/ngos/:id/document", requireAuth, requireAdmin, async (req, res) => {
  if (!validId(req.params.id) || !["approve", "reject"].includes(req.body.action)) return res.status(400).json({ message: "Choose approve or reject for a valid NGO." });
  try {
    const ngo = await NGO.findOneAndUpdate(
      { _id: req.params.id, verificationDocStatus: "pending_review", verificationDocPath: { $ne: null } },
      { verificationDocStatus: req.body.action === "approve" ? "approved" : "rejected" },
      { new: true }
    ).select("-verificationDocPath");
    if (!ngo) return res.status(404).json({ message: "Pending verification document not found." });
    res.json({ ngo, message: `NGO document ${req.body.action === "approve" ? "approved" : "rejected"}.` });
  } catch (error) {
    console.error("Review NGO document error:", error);
    res.status(500).json({ message: "Unable to update verification document status." });
  }
});

module.exports = router;
