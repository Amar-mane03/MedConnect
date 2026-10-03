const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
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
    default: "mentee",
  },
  authorSpecialty: {
    type: String,
    default: "General Medicine",
  },
  authorVerified: {
    type: Boolean,
    default: false,
  },
  initials: {
    type: String,
    default: "DR",
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const forumPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Career Guidance",
        "Exam Prep",
        "General Clinical",
        "Research & Academic",
        "Work-Life & Wellbeing",
      ],
      default: "Career Guidance",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
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
      default: "mentee",
    },
    authorSpecialty: {
      type: String,
      default: "General Medicine",
    },
    authorVerified: {
      type: Boolean,
      default: false,
    },
    initials: {
      type: String,
      default: "DR",
    },
    upvotes: {
      type: Number,
      default: 0,
    },
    upvotedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replies: [replySchema],
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ForumPost", forumPostSchema);

