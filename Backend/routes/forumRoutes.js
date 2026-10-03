const express = require("express");
const ForumPost = require("../models/ForumPost");
const User = require("../models/user");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

function formatTimeAgo(date) {
  if (!date) return "Recently";
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// GET /api/forums - Retrieve threads with category filtering, search, and sorting
router.get("/", requireAuth, async (req, res) => {
  try {
    const { category, search, sort = "newest" } = req.query;
    const query = {};

    if (category && category !== "All") {
      query.category = category;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ title: regex }, { content: regex }, { tags: regex }];
    }

    let sortOptions = { isPinned: -1, createdAt: -1 };
    if (sort === "popular") {
      sortOptions = { isPinned: -1, upvotes: -1, createdAt: -1 };
    }

    const posts = await ForumPost.find(query)
      .sort(sortOptions)
      .populate("author", "name specialty role mentorVerificationStatus hospital");

    const formattedPosts = posts.map((p) => ({
      id: p._id,
      _id: p._id,
      title: p.title,
      content: p.content,
      category: p.category,
      tags: p.tags || [],
      author: p.authorName || p.author?.name || "Dr. Clinician",
      authorId: p.author?._id || p.author,
      role: p.authorRole || p.author?.role || "mentee",
      specialty: p.authorSpecialty || p.author?.specialty || "General Medicine",
      verified: p.authorVerified ?? (p.author?.mentorVerificationStatus === "verified"),
      initials: p.initials || "DR",
      upvotes: p.upvotes || 0,
      upvotedUsers: p.upvotedUsers || [],
      repliesCount: p.replies ? p.replies.length : 0,
      isPinned: p.isPinned || false,
      timeAgo: formatTimeAgo(p.createdAt),
      createdAt: p.createdAt,
    }));

    res.json({ posts: formattedPosts });
  } catch (error) {
    console.error("Fetch forum posts error:", error);
    res.status(500).json({ message: "Unable to retrieve discussion threads." });
  }
});

// GET /api/forums/:id - Retrieve single thread with all replies
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id).populate(
      "author",
      "name specialty role mentorVerificationStatus hospital"
    );

    if (!post) {
      return res.status(404).json({ message: "Discussion thread not found." });
    }

    const formattedPost = {
      id: post._id,
      _id: post._id,
      title: post.title,
      content: post.content,
      category: post.category,
      tags: post.tags || [],
      author: post.authorName || post.author?.name || "Dr. Clinician",
      authorId: post.author?._id || post.author,
      role: post.authorRole || post.author?.role || "mentee",
      specialty: post.authorSpecialty || post.author?.specialty || "General Medicine",
      verified: post.authorVerified ?? (post.author?.mentorVerificationStatus === "verified"),
      initials: post.initials || "DR",
      upvotes: post.upvotes || 0,
      upvotedUsers: post.upvotedUsers || [],
      isPinned: post.isPinned || false,
      timeAgo: formatTimeAgo(post.createdAt),
      createdAt: post.createdAt,
      replies: (post.replies || []).map((r) => ({
        id: r._id,
        _id: r._id,
        author: r.authorName,
        authorId: r.author,
        role: r.authorRole,
        specialty: r.authorSpecialty,
        verified: r.authorVerified,
        initials: r.initials || "DR",
        content: r.content,
        likes: r.likes ? r.likes.length : 0,
        likedUsers: r.likes || [],
        timeAgo: formatTimeAgo(r.createdAt),
        createdAt: r.createdAt,
      })),
    };

    res.json({ post: formattedPost });
  } catch (error) {
    console.error("Fetch single forum post error:", error);
    res.status(500).json({ message: "Unable to load discussion thread." });
  }
});

// POST /api/forums - Create a new forum discussion thread
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Discussion title is required." });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Discussion content cannot be empty." });
    }

    const validCategories = [
      "Career Guidance",
      "Exam Prep",
      "General Clinical",
      "Research & Academic",
      "Work-Life & Wellbeing",
    ];

    const selectedCategory = validCategories.includes(category)
      ? category
      : "Career Guidance";

    const initials = req.user.name
      ? req.user.name
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "DR";

    const parsedTags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : typeof tags === "string"
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const newPost = await ForumPost.create({
      title: title.trim(),
      content: content.trim(),
      category: selectedCategory,
      tags: parsedTags,
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role || "mentee",
      authorSpecialty: req.user.specialty || "General Medicine",
      authorVerified: req.user.mentorVerificationStatus === "verified",
      initials,
      upvotes: 0,
      upvotedUsers: [],
      replies: [],
    });

    const formattedPost = {
      id: newPost._id,
      _id: newPost._id,
      title: newPost.title,
      content: newPost.content,
      category: newPost.category,
      tags: newPost.tags,
      author: newPost.authorName,
      authorId: newPost.author,
      role: newPost.authorRole,
      specialty: newPost.authorSpecialty,
      verified: newPost.authorVerified,
      initials: newPost.initials,
      upvotes: 0,
      upvotedUsers: [],
      repliesCount: 0,
      isPinned: false,
      timeAgo: "Just now",
      createdAt: newPost.createdAt,
    };

    // Emit live socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("new_forum_post", formattedPost);
    }

    res.status(201).json({
      message: "Discussion thread published successfully.",
      post: formattedPost,
    });
  } catch (error) {
    console.error("Create forum post error:", error);
    res.status(500).json({ message: "Unable to publish discussion thread." });
  }
});

// POST /api/forums/:id/reply - Post a reply to a thread
router.post("/:id/reply", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Reply content cannot be empty." });
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Discussion thread not found." });
    }

    const initials = req.user.name
      ? req.user.name
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "DR";

    const newReply = {
      author: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role || "mentee",
      authorSpecialty: req.user.specialty || "General Medicine",
      authorVerified: req.user.mentorVerificationStatus === "verified",
      initials,
      content: content.trim(),
      likes: [],
      createdAt: new Date(),
    };

    post.replies.push(newReply);
    await post.save();

    const createdReply = post.replies[post.replies.length - 1];

    const formattedReply = {
      id: createdReply._id,
      _id: createdReply._id,
      author: createdReply.authorName,
      authorId: createdReply.author,
      role: createdReply.authorRole,
      specialty: createdReply.authorSpecialty,
      verified: createdReply.authorVerified,
      initials: createdReply.initials,
      content: createdReply.content,
      likes: 0,
      likedUsers: [],
      timeAgo: "Just now",
      createdAt: createdReply.createdAt,
    };

    // Emit live socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("new_forum_reply", {
        postId: post._id,
        reply: formattedReply,
        repliesCount: post.replies.length,
      });
    }

    res.status(201).json({
      message: "Reply posted successfully.",
      reply: formattedReply,
      repliesCount: post.replies.length,
    });
  } catch (error) {
    console.error("Add forum reply error:", error);
    res.status(500).json({ message: "Unable to submit reply." });
  }
});

// POST /api/forums/:id/upvote - Upvote/un-upvote a discussion thread
router.post("/:id/upvote", requireAuth, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Discussion thread not found." });
    }

    const userIdStr = req.user._id.toString();
    const existingIndex = post.upvotedUsers.findIndex(
      (id) => id.toString() === userIdStr
    );

    let upvoted = false;
    if (existingIndex > -1) {
      post.upvotedUsers.splice(existingIndex, 1);
    } else {
      post.upvotedUsers.push(req.user._id);
      upvoted = true;
    }

    post.upvotes = post.upvotedUsers.length;
    await post.save();

    // Emit live socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("forum_upvoted", {
        postId: post._id,
        upvotes: post.upvotes,
      });
    }

    res.json({
      upvoted,
      isUpvoted: upvoted,
      upvotes: post.upvotes,
    });
  } catch (error) {
    console.error("Upvote forum post error:", error);
    res.status(500).json({ message: "Unable to update upvote." });
  }
});

// POST /api/forums/:id/reply/:replyId/like - Like/unlike a reply
router.post("/:id/reply/:replyId/like", requireAuth, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Discussion thread not found." });
    }

    const reply = post.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ message: "Reply not found." });
    }

    const userIdStr = req.user._id.toString();
    const existingIndex = reply.likes.findIndex(
      (id) => id.toString() === userIdStr
    );

    let liked = false;
    if (existingIndex > -1) {
      reply.likes.splice(existingIndex, 1);
    } else {
      reply.likes.push(req.user._id);
      liked = true;
    }

    await post.save();

    res.json({
      liked,
      isLiked: liked,
      likes: reply.likes.length,
    });
  } catch (error) {
    console.error("Like forum reply error:", error);
    res.status(500).json({ message: "Unable to update like." });
  }
});

module.exports = router;
