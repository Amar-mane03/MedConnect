const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "completed"], default: "active" },
  },
  { _id: false }
);

const ngoSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    mission: { type: String, required: true, trim: true, maxlength: 2000 },
    logoUrl: { type: String, default: "", trim: true },
    causeTags: { type: [String], default: [] },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    website: { type: String, default: "", trim: true },
    campaigns: { type: [campaignSchema], default: [] },
    isDemo: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
    verificationDocPath: { type: String, default: null },
    verificationDocStatus: { type: String, enum: ["unverified", "pending_review", "approved", "rejected"], default: "unverified", index: true },
    beneficiariesServed: { type: Number, default: 0, min: 0 },
    campsCompleted: { type: Number, default: 0, min: 0 },
    volunteersEngaged: { type: Number, default: 0, min: 0 },
    totalVerifiedHours: { type: Number, default: 0, min: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NGO", ngoSchema);
