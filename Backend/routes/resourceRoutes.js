const express = require("express");
const Resource = require("../models/Resource");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

function formatResource(resource) {
	const uploader = resource.uploader && typeof resource.uploader === "object" ? resource.uploader : null;
	return {
		id: resource._id,
		_id: resource._id,
		title: resource.title,
		description: resource.description,
		resourceType: resource.resourceType,
		url: resource.url,
		fileName: resource.fileName,
		fileSize: resource.fileSize,
		specialty: resource.specialty,
		tags: resource.tags,
		uploader: uploader?.name || "",
		uploaderRole: uploader?.role || "mentee",
		uploaderSpecialty: uploader?.specialty || "",
		verified: uploader?.mentorVerificationStatus === "verified",
		initials: uploader?.name ? uploader.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "",
		downloadsCount: resource.downloadsCount,
		likesCount: resource.likes.length,
		likes: resource.likes.map((id) => id.toString()),
		timeAgo: resource.createdAt ? new Date(resource.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recently",
	};
}

router.get("/", requireAuth, async (req, res) => {
	try {
		const { specialty, type, search, sort = "newest" } = req.query;
		const query = {};
		if (specialty && specialty !== "All") query.specialty = specialty;
		if (type && type !== "All") query.resourceType = type;
		if (search && search.trim()) query.$or = [
			{ title: new RegExp(search.trim(), "i") },
			{ description: new RegExp(search.trim(), "i") },
			{ tags: new RegExp(search.trim(), "i") },
		];
		const sortOptions = sort === "popular" ? { likes: -1, createdAt: -1 } : sort === "downloads" ? { downloadsCount: -1, createdAt: -1 } : { createdAt: -1 };
		const resources = await Resource.find(query).populate("uploader", "name role specialty mentorVerificationStatus").sort(sortOptions).limit(100);
		res.json({ resources: resources.map(formatResource) });
	} catch (error) {
		console.error("Fetch resources error:", error);
		res.status(500).json({ message: "Unable to load resources." });
	}
});

router.post("/", requireAuth, async (req, res) => {
	try {
		const { title, description, resourceType, url, fileName, fileSize, specialty, tags } = req.body;
		if (!title?.trim() || !url?.trim()) return res.status(400).json({ message: "Title and URL are required." });
		try { new URL(url); } catch { return res.status(400).json({ message: "Please provide a valid resource URL." }); }
		const resource = await Resource.create({ title: title.trim(), description: (description || "").trim(), resourceType, url: url.trim(), fileName, fileSize, specialty, tags: Array.isArray(tags) ? tags : [], uploader: req.user._id });
		await resource.populate("uploader", "name role specialty mentorVerificationStatus");
		const formattedResource = formatResource(resource);
		req.app.get("io")?.emit("new_resource_shared", formattedResource);
		res.status(201).json({ resource: formattedResource, message: "Resource shared successfully." });
	} catch (error) {
		console.error("Create resource error:", error);
		res.status(500).json({ message: "Unable to share resource." });
	}
});

router.post("/:id/like", requireAuth, async (req, res) => {
	try {
		const resource = await Resource.findById(req.params.id);
		if (!resource) return res.status(404).json({ message: "Resource not found." });
		const index = resource.likes.findIndex((id) => id.toString() === req.user._id.toString());
		if (index >= 0) resource.likes.splice(index, 1); else resource.likes.push(req.user._id);
		await resource.save();
		res.json({ isLiked: index < 0, likesCount: resource.likes.length });
	} catch (error) {
		console.error("Like resource error:", error);
		res.status(500).json({ message: "Unable to update resource like." });
	}
});

router.post("/:id/download", requireAuth, async (req, res) => {
	try {
		const resource = await Resource.findByIdAndUpdate(req.params.id, { $inc: { downloadsCount: 1 } }, { new: true });
		if (!resource) return res.status(404).json({ message: "Resource not found." });
		res.json({ downloadsCount: resource.downloadsCount });
	} catch (error) {
		console.error("Download resource error:", error);
		res.status(500).json({ message: "Unable to record resource download." });
	}
});

module.exports = router;
