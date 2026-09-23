const mongoose = require("mongoose");

const strokeSegmentSchema = new mongoose.Schema(
  {
    prevX: Number,
    prevY: Number,
    currX: Number,
    currY: Number,
    color: String,
    size: Number,
  },
  { _id: false }
);

const strokePathSchema = new mongoose.Schema(
  {
    id: String,
    userId: String,
    username: String,
    color: String,
    segments: [strokeSegmentSchema],
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    boardId: { type: String, required: true, unique: true, index: true },
    strokes: [strokePathSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Board", boardSchema);