const mongoose = require("mongoose");

const contentReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["case", "comment"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseStudy",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ["Patient privacy concern", "Harassment or abuse", "Potentially unsafe content", "Other"],
      required: true,
    },
    details: {
      type: String,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "dismissed", "actioned"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

contentReportSchema.index({ reporter: 1, targetType: 1, targetId: 1, status: 1 });

module.exports = mongoose.model("ContentReport", contentReportSchema);