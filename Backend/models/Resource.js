const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		description: { type: String, default: "", trim: true },
		resourceType: { type: String, enum: ["pdf", "link", "article", "notes", "guideline"], default: "link" },
		url: { type: String, required: true, trim: true },
		fileName: { type: String, default: "" },
		fileSize: { type: String, default: "" },
		specialty: { type: String, default: "General Medicine", trim: true },
		tags: { type: [String], default: [] },
		uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		downloadsCount: { type: Number, default: 0, min: 0 },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Resource", resourceSchema);
