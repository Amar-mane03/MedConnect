const mongoose = require("mongoose");

const caseStudySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    specialty: {
      type: String,
      required: true,
      index: true,
    },
    subspecialty: {
      type: String,
      default: "",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorRole: {
      type: String,
      default: "Consultant",
    },
    authorVerified: {
      type: Boolean,
      default: true,
    },
    authorInitials: {
      type: String,
      default: "DR",
    },
    preview: {
      type: String,
      required: true,
    },
    ageRange: {
      type: String,
      default: "30–39 years",
    },
    sex: {
      type: String,
      default: "Female",
    },
    presentingComplaint: {
      type: String,
      default: "",
    },
    history: {
      type: String,
      default: "",
    },
    investigations: {
      type: String,
      default: "",
    },
    diagnosis: {
      type: String,
      default: "",
    },
    treatment: {
      type: String,
      default: "",
    },
    outcome: {
      type: String,
      default: "",
    },
    learningPoints: {
      type: [String],
      default: [],
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    upvotesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["published", "draft", "flagged"],
      default: "published",
    },
  },
  {
    timestamps: true,
  }
);

caseStudySchema.index({ title: "text", preview: "text", diagnosis: "text" });

module.exports = mongoose.model("CaseStudy", caseStudySchema);
