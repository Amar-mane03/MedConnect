const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 8,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    specialty: {
      type: String,
      default: "",
    },
    subspecialty: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["mentor", "mentee", "admin"],
      default: "mentee",
    },
    careerStage: {
      type: String,
      default: "",
    },
    goals: {
      type: String,
      default: "",
    },
    communicationPreference: {
      type: String,
      default: "",
    },
    institution: {
      type: String,
      default: "",
    },
    hospital: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    degrees: {
      type: String,
      default: "",
    },
    licenseNumber: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    activeMenteesCount: {
      type: Number,
      default: 0,
    },
    caseStudiesCount: {
      type: Number,
      default: 0,
    },
    areasOfInterest: {
      type: [String],
      default: [],
    },
    savedCaseStudies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseStudy",
    }],
    notificationPreferences: {
      mentorship: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      caseComments: { type: Boolean, default: true },
    },
    publications: [
      {
        title: String,
        journal: String,
        year: String,
      },
    ],
    reviews: [
      {
        author: String,
        rating: Number,
        time: String,
        text: String,
      },
    ],
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    mentorVerificationStatus: {
      type: String,
      enum: ["not_required", "pending", "verified", "rejected"],
      default: "not_required",
    },
    mentorCredentialPath: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);