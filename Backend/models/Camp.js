const mongoose = require("mongoose");

const campSchema = new mongoose.Schema(
  {
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    causeCategory: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 3000 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    venue: { type: String, required: true, trim: true, maxlength: 240 },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    capacity: { type: Number, required: true, min: 1, max: 10000 },
    applicationsCount: { type: Number, default: 0, min: 0 },
    prerequisiteSkills: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Camp", campSchema);
