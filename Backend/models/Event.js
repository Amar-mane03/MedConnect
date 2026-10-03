const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		description: { type: String, default: "", trim: true },
		speakerName: { type: String, required: true, trim: true },
		speakerTitle: { type: String, default: "Clinician", trim: true },
		speakerSpecialty: { type: String, default: "General Medicine", trim: true },
		speakerHospital: { type: String, default: "", trim: true },
		date: { type: Date, required: true },
		durationMinutes: { type: Number, default: 60, min: 15, max: 480 },
		eventType: { type: String, enum: ["webinar", "workshop", "grand_rounds", "journal_club", "panel"], default: "webinar" },
		specialty: { type: String, default: "", trim: true },
		meetingLink: { type: String, default: "", trim: true },
		host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		attendeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
