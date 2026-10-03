const express = require("express");
const Event = require("../models/Event");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();
const eventTypes = ["webinar", "workshop", "grand_rounds", "journal_club", "panel"];

function formatEvent(event, userId) {
	const attendeeIds = (event.attendeeIds || []).map((id) => id.toString());
	const date = new Date(event.date);
	return {
		id: event._id,
		_id: event._id,
		title: event.title,
		description: event.description,
		speakerName: event.speakerName,
		speakerTitle: event.speakerTitle,
		speakerSpecialty: event.speakerSpecialty,
		speakerHospital: event.speakerHospital,
		date: event.date,
		formattedDate: date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
		durationMinutes: event.durationMinutes,
		eventType: event.eventType,
		specialty: event.specialty,
		meetingLink: event.meetingLink,
		attendeesCount: attendeeIds.length,
		attendeeIds,
		maxCapacity: event.maxCapacity || 500,
		isLive: date <= new Date() && date.getTime() + event.durationMinutes * 60000 > Date.now(),
		isPast: date < new Date(),
		isRsvp: userId ? attendeeIds.includes(userId.toString()) : false,
	};
}

router.get("/", requireAuth, async (req, res) => {
	try {
		const { filter = "upcoming", specialty, type, search } = req.query;
		const query = {};
		const now = new Date();
		query.date = filter === "past" ? { $lt: now } : { $gte: now };
		if (specialty && specialty !== "All") query.specialty = specialty;
		if (type && type !== "All") query.eventType = type;
		if (search && search.trim()) query.$or = [
			{ title: new RegExp(search.trim(), "i") },
			{ description: new RegExp(search.trim(), "i") },
			{ speakerName: new RegExp(search.trim(), "i") },
		];

		const events = await Event.find(query).sort({ date: filter === "past" ? -1 : 1 }).limit(100);
		res.json({ events: events.map((event) => formatEvent(event, req.user?._id)) });
	} catch (error) {
		console.error("Fetch events error:", error);
		res.status(500).json({ message: "Unable to load events." });
	}
});

router.post("/", requireAuth, async (req, res) => {
	try {
		if (!["mentor", "admin"].includes(req.user.role)) {
			return res.status(403).json({ message: "Only mentors can host clinical events." });
		}

		const { title, description, speakerName, speakerTitle, speakerSpecialty, speakerHospital, date, durationMinutes, eventType, specialty, meetingLink } = req.body;
		if (!title || !date || !eventTypes.includes(eventType)) {
			return res.status(400).json({ message: "Title, date, and a valid event type are required." });
		}
		const parsedDate = new Date(date);
		if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
			return res.status(400).json({ message: "Events must have a valid future date." });
		}

		const event = await Event.create({
			title: title.trim(), description: (description || "").trim(),
			speakerName: (speakerName || req.user.name).trim(), speakerTitle: speakerTitle || "Consultant",
			speakerSpecialty: speakerSpecialty || req.user.specialty || "General Medicine",
			speakerHospital: speakerHospital || req.user.hospital || "", date: parsedDate,
			durationMinutes: Number(durationMinutes) || 60, eventType, specialty: specialty || "",
			meetingLink: meetingLink || "", host: req.user._id, attendeeIds: [],
		});

		const formattedEvent = formatEvent(event, req.user._id);
		req.app.get("io")?.emit("new_event_scheduled", formattedEvent);
		res.status(201).json({ event: formattedEvent, message: "Event scheduled successfully." });
	} catch (error) {
		console.error("Create event error:", error);
		res.status(500).json({ message: "Unable to schedule event." });
	}
});

router.post("/:id/rsvp", requireAuth, async (req, res) => {
	try {
		const event = await Event.findById(req.params.id);
		if (!event) return res.status(404).json({ message: "Event not found." });
		const userId = req.user._id.toString();
		const attendeeIds = event.attendeeIds.map((id) => id.toString());
		const index = attendeeIds.indexOf(userId);
		let attending;
		if (index >= 0) {
			event.attendeeIds.splice(index, 1);
			attending = false;
		} else {
			event.attendeeIds.push(req.user._id);
			attending = true;
		}
		await event.save();
		const result = formatEvent(event, req.user._id);
		req.app.get("io")?.emit("event_rsvp_updated", { eventId: event._id, attendeesCount: result.attendeesCount });
		res.json({ message: attending ? "RSVP confirmed." : "RSVP cancelled.", attendeesCount: result.attendeesCount, isRsvp: attending });
	} catch (error) {
		console.error("RSVP error:", error);
		res.status(500).json({ message: "Unable to update RSVP." });
	}
});

module.exports = router;
