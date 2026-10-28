const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const Resource = require("../models/Resource");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();
const resourceDirectory = path.join(__dirname, "..", "uploads", "resources");
const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const allowedMimeTypes = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/octet-stream",
]);
fs.mkdirSync(resourceDirectory, { recursive: true });

const resourceUpload = multer({
	storage: multer.diskStorage({
		destination: resourceDirectory,
		filename: (req, file, callback) => {
			callback(null, `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
		},
	}),
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (req, file, callback) => {
		const extension = path.extname(file.originalname).toLowerCase();
		if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
			return callback(new Error("Choose a PDF, DOC, or DOCX document."));
		}
		callback(null, true);
	},
}).single("file");

function handleResourceUpload(req, res, next) {
	resourceUpload(req, res, (error) => {
		if (!error) return next();
		if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
			return res.status(413).json({ message: "Documents must be 10 MB or smaller." });
		}
		return res.status(400).json({ message: error.message || "Unable to upload this document." });
	});
}

function removeUploadedFile(file) {
	if (!file) return;
	try {
		fs.unlinkSync(file.path);
	} catch (error) {
		console.error("Remove incomplete resource upload error:", error);
	}
}

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
		isUploaded: Boolean(resource.storageName),
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

router.post("/", requireAuth, handleResourceUpload, async (req, res) => {
	let resource;
	try {
		const { title, description, resourceType, url, fileName, fileSize, specialty, tags } = req.body;
		const trimmedUrl = typeof url === "string" ? url.trim() : "";
		if (!title?.trim()) {
			removeUploadedFile(req.file);
			return res.status(400).json({ message: "A title is required." });
		}
		if (!req.file && !trimmedUrl) {
			return res.status(400).json({ message: "Choose a document or provide a resource URL." });
		}
		if (!req.file) {
			try {
				const parsedUrl = new URL(trimmedUrl);
				if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported protocol");
			} catch {
				return res.status(400).json({ message: "Please provide a valid HTTP or HTTPS resource URL." });
			}
		}

		let parsedTags = tags;
		if (typeof tags === "string") {
			try {
				parsedTags = JSON.parse(tags);
			} catch {
				removeUploadedFile(req.file);
				return res.status(400).json({ message: "Resource tags must be a valid list." });
			}
		}

		resource = await Resource.create({
			title: title.trim(),
			description: (description || "").trim(),
			resourceType,
			url: trimmedUrl,
			fileName: req.file ? path.basename(req.file.originalname) : (fileName || ""),
			fileSize: req.file ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : (fileSize || ""),
			storageName: req.file?.filename || "",
			specialty,
			tags: Array.isArray(parsedTags) ? parsedTags : [],
			uploader: req.user._id,
		});
		if (req.file) {
			resource.url = `/api/resources/${resource._id}/file`;
			await resource.save();
		}
		await resource.populate("uploader", "name role specialty mentorVerificationStatus");
		const formattedResource = formatResource(resource);
		req.app.get("io")?.emit("new_resource_shared", formattedResource);
		res.status(201).json({ resource: formattedResource, message: "Resource shared successfully." });
	} catch (error) {
		if (req.file && !resource) removeUploadedFile(req.file);
		console.error("Create resource error:", error);
		res.status(500).json({ message: "Unable to share resource." });
	}
});

router.get("/:id/file", requireAuth, async (req, res) => {
	try {
		const resource = await Resource.findById(req.params.id);
		if (!resource) return res.status(404).json({ message: "Resource not found." });
		if (!resource.storageName) return res.status(404).json({ message: "This resource does not have an uploaded document." });

		const filePath = path.join(resourceDirectory, path.basename(resource.storageName));
		if (!fs.existsSync(filePath)) return res.status(404).json({ message: "The uploaded document is no longer available." });

		await Resource.updateOne({ _id: resource._id }, { $inc: { downloadsCount: 1 } });
		res.download(filePath, path.basename(resource.fileName || "document"), (error) => {
			if (error) {
				console.error("Download resource file error:", error);
				if (!res.headersSent) res.status(500).json({ message: "Unable to download this document." });
			}
		});
	} catch (error) {
		console.error("Download resource file error:", error);
		if (!res.headersSent) res.status(500).json({ message: "Unable to download this document." });
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
