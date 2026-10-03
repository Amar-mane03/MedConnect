const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/user");
const CaseStudy = require("./models/CaseStudy");
const ForumPost = require("./models/ForumPost");
const MentorshipRequest = require("./models/MentorshipRequest");
const { Conversation, Message } = require("./models/Message");

const demoEmails = [
  "admin@medconnect.org",
  "aisha.patel@medconnect.org",
  "marcus.osei@medconnect.org",
  "sarah.kim@medconnect.org",
  "james.crawford@medconnect.org",
  "priya.mehta@nhs.net",
  "o.adeyemi@nhs.net",
  "yuki.tanaka@gosh.nhs.uk",
  "ahmed.hassan@kcl.ac.uk",
  "claire.dubois@uclh.nhs.uk",
  "student@medconnect.org",
];

async function cleanup() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");

  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ email: { $in: demoEmails } }).select("_id email").lean();
  const userIds = users.map((user) => user._id);
  const authorNames = [
    "Dr. Aisha Patel",
    "Dr. Marcus Osei",
    "Dr. Sarah Kim",
    "Dr. James Crawford",
    "Dr. Priya Mehta",
    "Dr. Oluwaseun Adeyemi",
    "Dr. Yuki Tanaka",
    "Dr. Ahmed Hassan",
    "Dr. Claire Dubois",
  ];

  const forumResult = await ForumPost.deleteMany({
    $or: [{ author: { $in: userIds } }, { authorName: { $in: authorNames } }],
  });
  const caseResult = await CaseStudy.deleteMany({ author: { $in: userIds } });
  const requestResult = await MentorshipRequest.deleteMany({
    $or: [{ mentor: { $in: userIds } }, { mentee: { $in: userIds } }],
  });
  const messageResult = await Message.deleteMany({
    $or: [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }],
  });
  const conversationResult = await Conversation.deleteMany({ participants: { $in: userIds } });
  const resources = await mongoose.connection.collection("resources").deleteMany({
    $or: [{ uploader: { $in: userIds } }, { uploadedBy: { $in: userIds } }],
  });
  const groups = await mongoose.connection.collection("groups").deleteMany({
    $or: [
      { createdBy: { $in: userIds } },
      { memberIds: { $in: userIds } },
      { "members.user": { $in: userIds } },
    ],
  });
  const events = await mongoose.connection.collection("events").deleteMany({
    $or: [{ host: { $in: userIds } }, { createdBy: { $in: userIds } }],
  });
  const notifications = await mongoose.connection.collection("notifications").deleteMany({
    $or: [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }],
  });
  const userResult = await User.deleteMany({ email: { $in: demoEmails } });

  console.log(JSON.stringify({
    users: userResult.deletedCount,
    forums: forumResult.deletedCount,
    cases: caseResult.deletedCount,
    requests: requestResult.deletedCount,
    messages: messageResult.deletedCount,
    conversations: conversationResult.deletedCount,
    resources: resources.deletedCount,
    groups: groups.deletedCount,
    events: events.deletedCount,
    notifications: notifications.deletedCount,
  }));
}

cleanup()
  .catch((error) => {
    console.error("Demo content cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());