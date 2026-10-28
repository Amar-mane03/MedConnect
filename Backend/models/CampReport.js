const mongoose = require("mongoose");

const campReportSchema = new mongoose.Schema(
  {
    camp: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, unique: true, index: true },
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO", required: true, index: true },
    beneficiariesServed: { type: Number, required: true, min: 0 },
    volunteersAttended: { type: Number, required: true, min: 0 },
    resourcesDistributed: {
      kits: { type: Number, default: 0, min: 0 },
      medicines: { type: Number, default: 0, min: 0 },
      books: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },
    successNotes: { type: String, required: true, trim: true, maxlength: 5000 },
    photoUrls: { type: [String], default: [] },
    attendeeApplicationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "CampApplication" }],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CampReport", campReportSchema);
