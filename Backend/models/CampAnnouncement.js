const mongoose = require("mongoose");

const campAnnouncementSchema = new mongoose.Schema(
  {
    camp: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, index: true },
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO", required: true, index: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CampAnnouncement", campAnnouncementSchema);
