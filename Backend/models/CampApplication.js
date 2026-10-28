const mongoose = require("mongoose");

const campApplicationSchema = new mongoose.Schema(
  {
    camp: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    statement: { type: String, required: true, trim: true, maxlength: 1500 },
    status: { type: String, enum: ["consent_pending", "pending", "approved", "rejected", "waitlisted", "completed", "cancelled"], default: "pending", index: true },
    volunteerHours: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
    qrCode: { type: String, default: null },
    qrTokenHash: { type: String, default: null, select: false },
    checkedInAt: { type: Date, default: null },
    badgeIssued: { type: Boolean, default: false },
    guardianEmail: { type: String, default: null, trim: true },
    consentStatus: { type: String, enum: ["not_required", "pending_email", "pending_document_review", "approved"], default: "not_required", index: true },
    consentTokenHash: { type: String, default: null, select: false },
    consentTokenExpiresAt: { type: Date, default: null },
    consentDocumentPath: { type: String, default: null, select: false },
    waitlistPosition: { type: Number, default: null },
  },
  { timestamps: true }
);

campApplicationSchema.index({ camp: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("CampApplication", campApplicationSchema);
