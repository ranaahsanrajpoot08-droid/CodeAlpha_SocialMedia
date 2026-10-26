// Socket.IO: real-time part of messaging.
// Every message is saved in MySQL FIRST, and only then delivered / confirmed.
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import {
  saveMessage,
  markConversationRead,
  getUnreadTotal,
  parseUserId,
  emitNewMessage,
  emitMessagesRead,
  userRoom,
} from '../services/messageService.js';

// Simple in-memory limiter: max 30 socket messages per minute per user.
const sendTimes = new Map();
const isRateLimited = (userId) => {
  const now = Date.now();
  const recent = (sendTimes.get(userId) || []).filter((t) => now - t < 60 * 1000);
  if (recent.length >= 30) {
    sendTimes.set(userId, recent);
    return true;
  }
  recent.push(now);
  sendTimes.set(userId, recent);
  return false;
};

// Turns an error into a safe { ok:false, message } reply for the client.
const errorReply = (error) => {
  if (error.isOperational) return { ok: false, message: error.message };
  console.error('💥 Socket error:', error);
  return { ok: false, message: 'Server error. Please try again.' };
};

// Who is online? userId -> number of open tabs/devices.
const onlineCounts = new Map();

export const initSocket = (httpServer, allowedOrigins) => {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
    maxHttpBufferSize: 1e5, // 100 KB - socket messages are small text only (files go through the REST API)
  });

  // ---- 1. Authenticate every connection with the SAME JWT used by the REST API ----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Not authorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [decoded.id]);
      if (rows.length === 0) return next(new Error('Not authorized'));

      socket.userId = rows[0].id; // taken from the verified token, never from the client
      next();
    } catch (error) {
      next(new Error('Not authorized'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.userId;

    // ---- 2. Each user has a private room, so we can reach all of their open tabs ----
    socket.join(userRoom(me));

    // ---- 3. Online status ----
    const count = (onlineCounts.get(me) || 0) + 1;
    onlineCounts.set(me, count);
    if (count === 1) io.emit('presence', { userId: me, online: true });
    socket.emit('presence:list', { online: [...onlineCounts.keys()] });

    socket.on('disconnect', () => {
      const left = (onlineCounts.get(me) || 1) - 1;
      if (left <= 0) {
        onlineCounts.delete(me);
        io.emit('presence', { userId: me, online: false });
      } else {
        onlineCounts.set(me, left);
      }
    });

    // ---- 4. Send a text message ----
    // client: socket.emit('message:send', { receiverId, text, clientId, replyToId }, (reply) => ...)
    // (photos and files are sent with the REST API instead)
    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!payload || typeof payload !== 'object') return reply({ ok: false, message: 'Invalid message' });
        if (isRateLimited(me)) return reply({ ok: false, message: 'You are sending messages too fast.' });

        // The sender is ALWAYS "me" (from the JWT). payload.senderId is ignored.
        const { message, created } = await saveMessage(me, payload.receiverId, {
          text: payload.text,
          clientId: payload.clientId,
          replyToId: payload.replyToId,
        });
        if (created) emitNewMessage(io, message); // only deliver once, even if the client retries
        reply({ ok: true, message });
      } catch (error) {
        reply(errorReply(error));
      }
    });

    // ---- 5. Mark a conversation as read ----
    // client: socket.emit('message:read', { userId }, (reply) => ...)
    socket.on('message:read', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const otherId = parseUserId(payload?.userId);
        const updated = await markConversationRead(me, otherId);
        if (updated > 0) emitMessagesRead(io, me, otherId);
        reply({ ok: true, updated, unread_count: await getUnreadTotal(me) });
      } catch (error) {
        reply(errorReply(error));
      }
    });

    // ---- 6. "typing..." indicator ----
    // client: socket.emit('typing', { userId, typing: true|false })
    socket.on('typing', (payload) => {
      try {
        const otherId = parseUserId(payload?.userId);
        if (otherId === me) return;
        io.to(userRoom(otherId)).emit('typing', { userId: me, typing: Boolean(payload.typing) });
      } catch (error) {
        // ignore bad typing events
      }
    });
  });

  return io;
};
