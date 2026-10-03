const express = require("express");
const Notification = require("../models/Notification");
const User = require("../models/user");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();
const preferenceCategories = ["mentorship", "messages", "caseComments"];

router.get("/preferences", requireAuth, async (req, res) => {
	const preferences = req.user.notificationPreferences?.toObject?.() || req.user.notificationPreferences || {};
	res.json({
		preferences: Object.fromEntries(preferenceCategories.map(category => [category, preferences[category] !== false])),
	});
});

router.put("/preferences", requireAuth, async (req, res) => {
	try {
		const updates = {};
		for (const category of preferenceCategories) {
			if (typeof req.body?.[category] !== "boolean") {
				return res.status(400).json({ message: `Preference '${category}' must be a boolean.` });
			}
			updates[`notificationPreferences.${category}`] = req.body[category];
		}

		const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true }).select("notificationPreferences");
		res.json({ preferences: user.notificationPreferences });
	} catch (error) {
		console.error("Update notification preferences error:", error);
		res.status(500).json({ message: "Unable to update notification preferences." });
	}
});

router.patch("/read-all", requireAuth, async (req, res) => {
	try {
		const result = await Notification.updateMany(
			{ recipient: req.user._id, readAt: null },
			{ readAt: new Date() }
		);
		res.json({ updated: result.modifiedCount });
	} catch (error) {
		console.error("Mark notifications read error:", error);
		res.status(500).json({ message: "Unable to update notifications." });
	}
});

router.patch("/:id/read", requireAuth, async (req, res) => {
	try {
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, recipient: req.user._id },
			{ readAt: new Date() },
			{ new: true }
		);
		if (!notification) return res.status(404).json({ message: "Notification not found." });
		res.json({ notification });
	} catch (error) {
		console.error("Mark notification read error:", error);
		res.status(500).json({ message: "Unable to update notification." });
	}
});

router.get("/", requireAuth, async (req, res) => {
	try {
		const notifications = await Notification.find({ recipient: req.user._id })
			.sort({ createdAt: -1 })
			.limit(30)
			.populate("actor", "name");
		const unreadCount = notifications.filter(notification => !notification.readAt).length;
		res.json({ notifications, unreadCount });
	} catch (error) {
		console.error("Load notifications error:", error);
		res.status(500).json({ message: "Unable to load notifications." });
	}
});

module.exports = router;
