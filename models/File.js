import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
  blobName: { type: String, required: true },
  roomId: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  expiryHours: { type: Number, required: true }, // Defines how long the file should exist
  expiresAt: { type: Date, required: true },
});

// Middleware to automatically set `expiresAt` before saving

export default mongoose.models.File || mongoose.model("File", FileSchema);
