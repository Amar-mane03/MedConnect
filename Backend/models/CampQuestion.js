const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true, _id: true }
);

const campQuestionSchema = new mongoose.Schema(
  {
    camp: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CampQuestion", campQuestionSchema);
