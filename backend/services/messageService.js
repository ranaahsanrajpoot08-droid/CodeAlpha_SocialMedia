// Messaging logic shared by the REST controller AND the Socket.IO handler,
// so both paths use exactly the same validation and database code.
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

export const MAX_MESSAGE_LENGTH = 1000;
const CLIENT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

// Database row -> JSON for the frontend
export const formatMessage = (row) => ({
  id: row.id,
  sender_id: row.sender_id,
  receiver_id: row.receiver_id,
  message_text: row.message_text,
  is_read: Boolean(row.is_read),
  client_id: row.client_id || null,
  created_at: row.created_at,
});

// Converts "5", 5 -> 5 and throws for anything that is not a positive whole number.
export const parseUserId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid user id', 400);
  return id;
};

export const ensureUserExists = async (userId) => {
  const [rows] = await pool.query(
    'SELECT id, name, username, profile_image FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) throw new AppError('User not found', 404);
  return rows[0];
};

// Saves a message. senderId ALWAYS comes from the verified JWT, never from the client.
// Returns { message, created }. created=false means "this client_id was already saved"
// (a retry after reconnect), so nothing new was inserted.
export const saveMessage = async (senderId, receiverId, rawText, rawClientId) => {
  receiverId = parseUserId(receiverId);
  if (receiverId === senderId) throw new AppError('You cannot message yourself', 400);

  if (typeof rawText !== 'string') throw new AppError('Message must be text', 400);
  const text = rawText.trim();
  if (!text) throw new AppError('Message cannot be empty', 400);
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`, 400);
  }

  let clientId = null;
  if (rawClientId !== undefined && rawClientId !== null && rawClientId !== '') {
    if (typeof rawClientId !== 'string' || !CLIENT_ID_REGEX.test(rawClientId)) {
      throw new AppError('Invalid client id', 400);
    }
    clientId = rawClientId;
  }

  await ensureUserExists(receiverId);

  const [result] = await pool.query(
    'INSERT IGNORE INTO messages (sender_id, receiver_id, message_text, client_id) VALUES (?, ?, ?, ?)',
    [senderId, receiverId, text, clientId]
  );

  if (result.affectedRows === 0) {
    // Duplicate (sender_id, client_id): return the message that was saved the first time.
    const [existing] = await pool.query('SELECT * FROM messages WHERE sender_id = ? AND client_id = ?', [
      senderId,
      clientId,
    ]);
    return { message: formatMessage(existing[0]), created: false };
  }

  const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
  return { message: formatMessage(rows[0]), created: true };
};

// Marks messages that otherUserId sent to readerId as read.
// Only the RECEIVER (readerId) can do this - the WHERE clause enforces it.
export const markConversationRead = async (readerId, otherUserId) => {
  const [result] = await pool.query(
    'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
    [otherUserId, readerId]
  );
  return result.affectedRows;
};

export const getUnreadTotal = async (userId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND is_read = FALSE',
    [userId]
  );
  return Number(rows[0].total);
};

// ---- Real-time delivery helpers (each user has a Socket.IO "room" named user:<id>) ----
export const userRoom = (userId) => `user:${userId}`;

// Sends a saved message to the receiver AND to the sender's other open tabs.
export const emitNewMessage = (io, message) => {
  if (!io) return;
  io.to(userRoom(message.receiver_id)).to(userRoom(message.sender_id)).emit('message:new', message);
};

// Tells the original sender "your messages were seen by readerId".
export const emitMessagesRead = (io, readerId, otherUserId) => {
  if (!io) return;
  io.to(userRoom(otherUserId)).emit('message:read', { readerId });
  io.to(userRoom(readerId)).emit('unread:changed'); // other tabs of the reader refresh their badge
};
