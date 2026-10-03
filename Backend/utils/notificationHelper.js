const Notification = require("../models/Notification");
const User = require("../models/user");

async function createNotification(io, { recipientId, actorId, category, title, message, page, targetId }) {
	try {
		if (!recipientId || (actorId && recipientId.toString() === actorId.toString())) return null;

		const recipient = await User.findById(recipientId).select("notificationPreferences");
		if (!recipient || recipient.notificationPreferences?.[category] === false) return null;

		const notification = await Notification.create({
			recipient: recipientId,
			actor: actorId || null,
			category,
			title,
			message,
			page,
			targetId: targetId ? targetId.toString() : "",
		});

		const payload = {
			id: notification._id,
			category,
			title,
			message,
			page,
			targetId: notification.targetId,
			createdAt: notification.createdAt,
			readAt: notification.readAt,
		};
		io?.to(recipientId.toString()).emit("notification_created", payload);
		return payload;
	} catch (error) {
		console.error("Create notification error:", error);
		return null;
	}
}

module.exports = { createNotification };
