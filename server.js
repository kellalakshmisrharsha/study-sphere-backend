import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import Message from './models/Message.js';
import messageRoutes from './routes/messages.js';
import dbConnect from './lib/dbConnect.js';
import { fileURLToPath } from 'url';
import { uploadFileToAzure } from './azureStorage.js';
import { BlobServiceClient } from '@azure/storage-blob';
import Room from './models/Room.js';
import { nanoid } from 'nanoid';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/messages', messageRoutes);

// API for file uploads
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Parse expiryHours from form data (it will be a string)
    const expiryHours = parseInt(req.body.expiryHours, 10);
    let expiresAt = null;
    if (!isNaN(expiryHours) && expiryHours > 0) {
      expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }

    const azureFileUrl = await uploadFileToAzure(req.file.path, req.file.filename);
    return res.status(200).json({
      success: true,
      fileUrl: azureFileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      expiresAt, // send expiry to client for reference
    });
  } catch (error) {
    console.error("Azure upload failed:", error);
    return res.status(500).json({ error: "Failed to upload to Azure Blob Storage" });
  }
});

// Setting up Socket.io for real-time messaging
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN, methods: ['GET', 'POST'], credentials: true }
});

io.on('connection', (socket) => {
  console.log('⚡ New client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`🟢 User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send-message', async ({ roomId, message, expiryHours }) => {
    try {
      await dbConnect();

      if (message.type === 'text' && !message.content) {
        socket.emit('error-message', { error: 'Message content is required.' });
        return;
      }
      if (message.type === 'file' && !message.fileUrl) {
        socket.emit('error-message', { error: 'File URL is required.' });
        return;
      }

      const messageData = {
        roomId,
        sender: message.sender,
        type: message.type,
        timestamp: message.timestamp,
        encrypted: !!message.encrypted, // Ensure encrypted flag is saved
      };

      if (message.type === 'text') {
        messageData.content = message.content;
      } else if (message.type === 'file') {
        messageData.fileUrl = message.fileUrl;
        messageData.fileType = message.fileType;
        messageData.fileName = message.fileName;
        if (message.expiresAt) {
          messageData.expiresAt = message.expiresAt;
        }
      }

      const saved = await Message.create(messageData);
      io.to(roomId).emit('receive-message', saved); // Emit to all clients in the room, including sender
    } catch (err) {
      console.error('❌ Error saving message:', err);
      socket.emit('error-message', { error: 'Failed to save message.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

async function deleteExpiredFilesAndRooms() {
  await dbConnect();
  const now = new Date();
  // Delete expired files
  const expiredFiles = await Message.find({ type: 'file', expiresAt: { $lte: now } });
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);

  for (const file of expiredFiles) {
    try {
      const blobName = file.fileName; // or however you store the blob name
      await containerClient.deleteBlob(blobName);
      await file.deleteOne();
      console.log(`Deleted expired file: ${blobName}`);
    } catch (err) {
      if (err.statusCode !== 404) {
        console.error('Failed to delete blob:', err);
      } // else ignore 404
    }
  }

  // Delete expired rooms and their messages/files
  const expiredRooms = await Room.find({ expiresAt: { $lte: now } });
  for (const room of expiredRooms) {
    try {
      // Delete all messages for this room
      const roomMessages = await Message.find({ roomId: room.code });
      for (const msg of roomMessages) {
        if (msg.type === 'file' && msg.fileName) {
          try {
            await containerClient.deleteBlob(msg.fileName);
          } catch (err) {
            if (err.statusCode !== 404) {
              console.error('Failed to delete file blob for expired room:', err);
            } // else ignore 404
          }
        }
        await msg.deleteOne();
      }
      await room.deleteOne();
      console.log(`Deleted expired room and its messages/files: ${room.code}`);
    } catch (err) {
      console.error('Failed to delete expired room:', err);
    }
  }

  // Delete rooms with no members (optional, if you want to keep this logic)
  const emptyRooms = await Room.find({ members: { $size: 0 } });
  for (const room of emptyRooms) {
    try {
      await room.deleteOne();
      console.log(`Deleted empty room: ${room.code}`);
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  }
}

// Run every hour
let isCleaning = false;
setInterval(async () => {
  if (isCleaning) return;
  isCleaning = true;
  try {
    await deleteExpiredFilesAndRooms();
  } finally {
    isCleaning = false;
  }
}, 60 * 60 * 1000);
// Also run once at startup
(async () => {
  await deleteExpiredFilesAndRooms(); // Run cleanup on startup

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
})();
