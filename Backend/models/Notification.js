const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
	{
		recipient: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		actor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		category: {
			type: String,
			enum: ["mentorship", "messages", "caseComments"],
			required: true,
		},
		title: { type: String, required: true, maxlength: 120 },
		message: { type: String, required: true, maxlength: 300 },
		page: { type: String, enum: ["messages", "mentor-profile", "case-detail"], required: true },
		targetId: { type: String, default: "" },
		readAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
