const express = require("express");
const { Conversation, Message } = require("../models/Message");
const User = require("../models/user");
const { requireAuth } = require("../middlewares/authMiddleware");
const { createNotification } = require("../utils/notificationHelper");

const router = express.Router();

// GET all conversations for the current user
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    let conversations = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name specialty role mentorVerificationStatus hospital");

    // If user has no conversations yet, populate an initial conversation with a top verified mentor so chat is immediately usable
    if (conversations.length === 0) {
      const topMentor = await User.findOne({ role: "mentor", _id: { $ne: userId } });
      if (topMentor) {
        const welcomeConv = await Conversation.create({
          participants: [userId, topMentor._id],
          lastMessage: "Hello! Welcome to MedConnect clinical messaging.",
          lastMessageAt: new Date(),
        });

        await Message.create({
          conversationId: welcomeConv._id,
          sender: topMentor._id,
          senderName: topMentor.name,
          recipient: userId,
          text: "Hello! Welcome to MedConnect. Feel free to ask any clinical questions or share case observations here.",
        });

        conversations = await Conversation.find({ _id: welcomeConv._id })
          .populate("participants", "name specialty role mentorVerificationStatus hospital");
      }
    }

    const formatted = conversations.map(c => {
      const other = c.participants.find(p => p._id.toString() !== userId.toString()) || c.participants[0];
      return {
        id: c._id,
        _id: c._id,
        name: other?.name || "Dr. Colleague",
        role: other?.specialty || (other?.role === "mentor" ? "Consultant" : "Resident"),
        initials: other?.name ? other.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "MD",
        lastMsg: c.lastMessage || "No messages yet",
        time: formatTime(c.lastMessageAt),
        unread: c.unreadCounts?.get(userId.toString()) || 0,
        online: true,
        otherUser: other,
      };
    });

    res.json({ conversations: formatted });
  } catch (error) {
    console.error("Fetch conversations error:", error);
    res.status(500).json({ message: "Unable to load conversations." });
  }
});

// GET messages for a conversation
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .populate("sender", "name specialty role");

    res.json({
      messages: messages.map(m => ({
        id: m._id,
        _id: m._id,
        from: m.sender._id.toString() === req.user._id.toString() ? "me" : "them",
        senderId: m.sender._id,
        senderName: m.senderName || m.sender.name,
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ message: "Unable to load message history." });
  }
});

// POST send message in conversation
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message cannot be empty." });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const recipientId = conversation.participants.find(p => p.toString() !== req.user._id.toString());

    const message = await Message.create({
      conversationId: conversation._id,
      sender: req.user._id,
      senderName: req.user.name,
      recipient: recipientId || req.user._id,
      text: text.trim(),
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const formattedMessage = {
      id: message._id,
      _id: message._id,
      conversationId: conversation._id,
      from: "me",
      senderId: req.user._id,
      senderName: req.user.name,
      recipientId: recipientId,
      text: message.text,
      time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: message.createdAt,
    };

    // Broadcast via Socket.io if initialized
    const io = req.app.get("io");
    if (io) {
      io.to(conversation._id.toString()).emit("chat_message", {
        ...formattedMessage,
        from: "them", // for recipients
      });
      if (recipientId) {
        io.to(recipientId.toString()).emit("conversation_updated", {
          conversationId: conversation._id,
          lastMessage: text.trim(),
          time: formattedMessage.time,
        });
      }
    }

    await createNotification(io, {
      recipientId,
      actorId: req.user._id,
      category: "messages",
      title: "New message",
      message: `${req.user.name} sent you a message.`,
      page: "messages",
      targetId: conversation._id,
    });

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Unable to send message." });
  }
});

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

module.exports = router;
