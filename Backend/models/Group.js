const mongoose = require("mongoose");

const groupPostSchema = new mongoose.Schema(
	{
		author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		content: { type: String, required: true, trim: true },
		likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	},
	{ timestamps: true }
);

const groupSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		specialty: { type: String, default: "General Medicine", trim: true },
		icon: { type: String, default: "🩺" },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		posts: [groupPostSchema],
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
