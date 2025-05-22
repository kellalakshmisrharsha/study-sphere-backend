// pages/api/messages.js
import dbConnect from '../../../lib/dbConnect';
import Message from '../../../models/Message';

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method === 'GET') {
      const { roomId } = req.query;
      if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

      const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
      return res.status(200).json({ messages });
    }

    if (req.method === 'POST') {
      const { roomId, sender, content } = req.body;
      if (!roomId || !sender || !content) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const newMessage = new Message({ roomId, sender, content });
      await newMessage.save();
      return res.status(201).json({ message: 'Message saved', newMessage });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
