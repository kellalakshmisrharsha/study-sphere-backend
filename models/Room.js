import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  creator: {
    type: String,
    required: true,
  },
  members: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Avoid re-compiling model on hot reload
export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
