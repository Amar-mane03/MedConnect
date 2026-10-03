const mongoose = require("mongoose");

const mentorshipRequestSchema = new mongoose.Schema(
  {
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    goals: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

mentorshipRequestSchema.index({ mentee: 1, mentor: 1 });

module.exports = mongoose.model("MentorshipRequest", mentorshipRequestSchema);
