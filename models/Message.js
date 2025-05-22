import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  type: { type: String, enum: ['text', 'file'], required: true },
  content: {
    type: String,
    required: function() { return this.type === 'text'; }
  },
  fileUrl: String,
  fileType: String,
  fileName: String,
  roomId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  encrypted: { type: Boolean, default: false },
});

const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

export default Message;
