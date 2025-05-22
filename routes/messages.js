// routes/messages.js
import express from 'express';
import Message from '../models/Message.js';
import dbConnect from '../lib/dbConnect.js';  // Adjust path as needed

const router = express.Router();

// GET messages by roomId
router.get('/', async (req, res) => {
  try {
    await dbConnect(); // Ensure you have a function to connect to your database
    const { roomId } = req.query;
    if (!roomId) {
      return res.status(400).json({ error: 'Missing roomId query parameter' });
    }

    const messages = await Message.find({ roomId }).sort({ createdAt: 1 }); // Sort by oldest first
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// POST a new message (optional, since you use socket.io to save messages)
router.post('/', async (req, res) => {
  try {
    await dbConnect(); // Ensure you have a function to connect to your database
    const { roomId, sender, content } = req.body;
    if (!roomId || !sender || !content) {
      return res.status(400).json({ error: 'Missing fields in request body' });
    }

    const newMessage = new Message({ roomId, sender, content });
    await newMessage.save();

    res.status(201).json({ message: 'Message saved', newMessage });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Server error saving message' });
  }
});

export default router;
