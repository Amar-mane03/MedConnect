const express = require("express");
const Group = require("../models/Group");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

function formatPost(post) {
	const author = post.author && typeof post.author === "object" ? post.author : null;
	return {
		id: post._id,
		_id: post._id,
		author: author?.name || "",
		authorId: author?._id || post.author,
		role: author?.role || "mentee",
		specialty: author?.specialty || "",
		verified: author?.mentorVerificationStatus === "verified",
		initials: author?.name ? author.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "",
		content: post.content,
		likesCount: post.likes.length,
		likes: post.likes.map((id) => id.toString()),
		timeAgo: post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recently",
	};
}

function formatGroup(group, userId) {
	const memberIds = group.memberIds.map((id) => id.toString());
	return {
		id: group._id,
		_id: group._id,
		name: group.name,
		description: group.description,
		specialty: group.specialty,
		icon: group.icon,
		membersCount: memberIds.length,
		postsCount: group.posts.length,
		latestPostTime: group.posts.length ? group.posts[group.posts.length - 1].createdAt : group.createdAt,
		memberIds,
		isMember: userId ? memberIds.includes(userId.toString()) : false,
	};
}

router.get("/", requireAuth, async (req, res) => {
	try {
		const { specialty, search } = req.query;
		const query = {};
		if (specialty && specialty !== "All") query.specialty = specialty;
		if (search && search.trim()) query.$or = [
			{ name: new RegExp(search.trim(), "i") },
			{ description: new RegExp(search.trim(), "i") },
		];
		const groups = await Group.find(query).sort({ updatedAt: -1 }).limit(100);
		res.json({ groups: groups.map((group) => formatGroup(group, req.user?._id)) });
	} catch (error) {
		console.error("Fetch groups error:", error);
		res.status(500).json({ message: "Unable to load groups." });
	}
});

router.get("/:id", requireAuth, async (req, res) => {
	try {
		const group = await Group.findById(req.params.id).populate("posts.author", "name role specialty mentorVerificationStatus");
		if (!group) return res.status(404).json({ message: "Group not found." });
		const formatted = formatGroup(group, req.user?._id);
		formatted.posts = group.posts.map(formatPost);
		res.json({ group: formatted });
	} catch (error) {
		console.error("Fetch group detail error:", error);
		res.status(500).json({ message: "Unable to load group." });
	}
});

router.post("/", requireAuth, async (req, res) => {
	try {
		const { name, description, specialty, icon } = req.body;
		if (!name?.trim() || !description?.trim()) return res.status(400).json({ message: "Name and description are required." });
		const group = await Group.create({ name: name.trim(), description: description.trim(), specialty: specialty || "General Medicine", icon: icon || "MD", createdBy: req.user._id, memberIds: [req.user._id], posts: [] });
		res.status(201).json({ group: formatGroup(group, req.user._id), message: "Group created successfully." });
	} catch (error) {
		console.error("Create group error:", error);
		res.status(500).json({ message: "Unable to create group." });
	}
});

router.post("/:id/join", requireAuth, async (req, res) => {
	try {
		const group = await Group.findByIdAndUpdate(req.params.id, { $addToSet: { memberIds: req.user._id } }, { new: true });
		if (!group) return res.status(404).json({ message: "Group not found." });
		res.json({ message: "Joined group.", group: formatGroup(group, req.user._id) });
	} catch (error) {
		res.status(500).json({ message: "Unable to join group." });
	}
});

router.post("/:id/leave", requireAuth, async (req, res) => {
	try {
		const group = await Group.findByIdAndUpdate(req.params.id, { $pull: { memberIds: req.user._id } }, { new: true });
		if (!group) return res.status(404).json({ message: "Group not found." });
		res.json({ message: "Left group.", group: formatGroup(group, req.user._id) });
	} catch (error) {
		res.status(500).json({ message: "Unable to leave group." });
	}
});

router.post("/:id/posts", requireAuth, async (req, res) => {
	try {
		const { content } = req.body;
		const group = await Group.findById(req.params.id);
		if (!group) return res.status(404).json({ message: "Group not found." });
		if (!group.memberIds.some((id) => id.toString() === req.user._id.toString())) return res.status(403).json({ message: "Join this group before posting." });
		if (!content?.trim()) return res.status(400).json({ message: "Post content cannot be empty." });
		group.posts.push({ author: req.user._id, content: content.trim(), likes: [] });
		await group.save();
		await group.populate("posts.author", "name role specialty mentorVerificationStatus");
		const post = formatPost(group.posts[group.posts.length - 1]);
		req.app.get("io")?.emit("new_group_post", { groupId: group._id, post });
		res.status(201).json({ post, message: "Post published." });
	} catch (error) {
		console.error("Create group post error:", error);
		res.status(500).json({ message: "Unable to publish group post." });
	}
});

router.post("/:id/posts/:postId/like", requireAuth, async (req, res) => {
	try {
		const group = await Group.findById(req.params.id);
		const post = group?.posts.id(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });
		const index = post.likes.findIndex((id) => id.toString() === req.user._id.toString());
		if (index >= 0) post.likes.splice(index, 1); else post.likes.push(req.user._id);
		await group.save();
		res.json({ isLiked: index < 0, likesCount: post.likes.length });
	} catch (error) {
		res.status(500).json({ message: "Unable to update post like." });
	}
});

module.exports = router;
