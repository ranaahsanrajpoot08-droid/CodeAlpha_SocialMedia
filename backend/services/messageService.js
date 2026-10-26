// Messaging logic shared by the REST controller AND the Socket.IO handler,
// so both paths use exactly the same validation and database code.
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { copyUploadedFile, deleteUploadedFile } from '../utils/files.js';

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_FORWARD_TARGETS = 5;
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const CLIENT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const stripVariation = (text) => text.replace(/️/g, ''); // "❤" and "❤️" are the same heart

// ---------------------------------------------------------------------------
// Reading messages
// ---------------------------------------------------------------------------

// A message row + the message it replies to (r_*).
const SELECT_MESSAGE = `
  SELECT m.*,
         r.id AS r_id, r.sender_id AS r_sender_id, r.message_text AS r_text, r.deleted_at AS r_deleted_at,
         r.attachment_name AS r_att_name, r.attachment_type AS r_att_type
  FROM messages m
  LEFT JOIN messages r ON r.id = m.reply_to_id
`;

// "I did not hide it with 'delete for me'" - needs (me, me) as parameters.
const VISIBLE_TO = `((m.sender_id = ? AND m.hidden_for_sender = FALSE) OR (m.receiver_id = ? AND m.hidden_for_receiver = FALSE))`;

const isImageType = (type) => Boolean(type && type.startsWith('image/'));

// Database row -> JSON for the frontend
export const formatMessage = (row, reactions = []) => ({
  id: row.id,
  sender_id: row.sender_id,
  receiver_id: row.receiver_id,
  message_text: row.message_text,
  is_read: Boolean(row.is_read),
  client_id: row.client_id || null,
  created_at: row.created_at,
  is_forwarded: Boolean(row.is_forwarded),
  is_deleted: Boolean(row.deleted_at), // unsent by the sender
  attachment: row.attachment_path
    ? {
        path: row.attachment_path,
        name: row.attachment_name,
        type: row.attachment_type,
        size: row.attachment_size,
        is_image: isImageType(row.attachment_type),
      }
    : null,
  reply_to: row.r_id
    ? {
        id: row.r_id,
        sender_id: row.r_sender_id,
        message_text: row.r_text,
        is_deleted: Boolean(row.r_deleted_at),
        attachment: row.r_att_name ? { name: row.r_att_name, is_image: isImageType(row.r_att_type) } : null,
      }
    : null,
  reactions,
});

// Adds the reactions to a list of rows and formats them.
const withReactions = async (rows) => {
  if (rows.length === 0) return [];
  const [reactionRows] = await pool.query(
    'SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (?) ORDER BY id',
    [rows.map((r) => r.id)]
  );
  const byMessage = new Map();
  reactionRows.forEach((r) => {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, []);
    byMessage.get(r.message_id).push({ user_id: r.user_id, emoji: r.emoji });
  });
  return rows.map((row) => formatMessage(row, byMessage.get(row.id) || []));
};

export const getMessageById = async (id) => {
  const [rows] = await pool.query(`${SELECT_MESSAGE} WHERE m.id = ?`, [id]);
  return (await withReactions(rows))[0] || null;
};

export const getReactions = async (messageId) => {
  const [rows] = await pool.query('SELECT user_id, emoji FROM message_reactions WHERE message_id = ? ORDER BY id', [
    messageId,
  ]);
  return rows;
};

// The chat history between me and otherId (newest 'limit' messages, optionally older than 'before').
export const fetchThread = async (me, otherId, { before, limit }) => {
  const params = [me, otherId, otherId, me, me, me];
  let beforeSql = '';
  if (before > 0) {
    beforeSql = 'AND m.id < ?';
    params.push(before);
  }
  const [rows] = await pool.query(
    `${SELECT_MESSAGE}
     WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
       AND ${VISIBLE_TO} ${beforeSql}
     ORDER BY m.id DESC
     LIMIT ?`,
    [...params, limit + 1]
  );
  const hasMore = rows.length > limit;
  const messages = await withReactions(rows.slice(0, limit).reverse()); // oldest -> newest
  return { messages, hasMore };
};

// The inbox: one row per person, with the last visible message and my unread count.
export const fetchConversations = async (me) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.profile_image,
            m.id AS last_id, m.sender_id AS last_sender_id, m.message_text AS last_text, m.created_at AS last_at,
            m.deleted_at AS last_deleted_at, m.attachment_name AS last_att_name, m.attachment_type AS last_att_type,
            (SELECT COUNT(*) FROM messages
               WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE
                 AND deleted_at IS NULL AND hidden_for_receiver = FALSE) AS unread_count
     FROM users u
     JOIN messages m ON m.id = (
       SELECT MAX(x.id) FROM messages x
       WHERE ((x.sender_id = ? AND x.receiver_id = u.id AND x.hidden_for_sender = FALSE)
           OR (x.sender_id = u.id AND x.receiver_id = ? AND x.hidden_for_receiver = FALSE))
     )
     WHERE u.id <> ?
     ORDER BY m.id DESC`,
    [me, me, me, me]
  );

  return rows.map((r) => ({
    user: { id: r.id, name: r.name, username: r.username, profile_image: r.profile_image },
    last_message: {
      id: r.last_id,
      sender_id: r.last_sender_id,
      message_text: r.last_text,
      is_deleted: Boolean(r.last_deleted_at),
      attachment: r.last_att_name ? { name: r.last_att_name, is_image: isImageType(r.last_att_type) } : null,
      created_at: r.last_at,
    },
    unread_count: Number(r.unread_count),
  }));
};

export const getUnreadTotal = async (userId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM messages
     WHERE receiver_id = ? AND is_read = FALSE AND deleted_at IS NULL AND hidden_for_receiver = FALSE`,
    [userId]
  );
  return Number(rows[0].total);
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Converts "5", 5 -> 5 and throws for anything that is not a positive whole number.
export const parseUserId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid id', 400);
  return id;
};

export const ensureUserExists = async (userId) => {
  const [rows] = await pool.query('SELECT id, name, username, profile_image FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) throw new AppError('User not found', 404);
  return rows[0];
};

// Returns the raw message row IF userId is a participant AND has not hidden it. Otherwise 404
// (404 instead of 403 so nobody can find out which message ids exist in other people's chats).
const getVisibleRow = async (userId, messageId) => {
  const [rows] = await pool.query(
    'SELECT * FROM messages WHERE id = ? AND ((sender_id = ? AND hidden_for_sender = FALSE) OR (receiver_id = ? AND hidden_for_receiver = FALSE))',
    [messageId, userId, userId]
  );
  if (rows.length === 0) throw new AppError('Message not found', 404);
  return rows[0];
};

// File names come from the user's computer: keep only a safe, short name for display.
// (Multer hands us UTF-8 file names decoded as latin1, so Urdu/Arabic names look broken: fix that first.)
const fixNameEncoding = (name) => {
  if (![...name].every((ch) => ch.charCodeAt(0) <= 0xff)) return name; // already real unicode
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
};

const cleanFileName = (name) => {
  const base = fixNameEncoding(String(name || 'file')).split(/[\\/]/).pop();
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().slice(0, 150);
  return cleaned || 'file';
};

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

// Saves a message. senderId ALWAYS comes from the verified JWT, never from the client.
// options: { text, clientId, replyToId, file }   (file = the multer file for an attachment)
// Returns { message, created }. created=false means "this client_id was already saved"
// (a retry after reconnect), so nothing new was inserted.
export const saveMessage = async (senderId, rawReceiverId, options = {}) => {
  const { text: rawText, clientId: rawClientId, replyToId: rawReplyToId, file } = options;
  const cleanup = () => file && deleteUploadedFile(`uploads/messages/${file.filename}`);

  try {
    const receiverId = parseUserId(rawReceiverId);
    if (receiverId === senderId) throw new AppError('You cannot message yourself', 400);

    if (rawText !== undefined && rawText !== null && typeof rawText !== 'string') {
      throw new AppError('Message must be text', 400);
    }
    const text = (rawText || '').trim();
    if (!text && !file) throw new AppError('Message cannot be empty', 400);
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

    // Replying: the original must be in THIS conversation and not unsent.
    let replyToId = null;
    if (rawReplyToId !== undefined && rawReplyToId !== null && rawReplyToId !== '') {
      replyToId = parseUserId(rawReplyToId);
      const [original] = await pool.query(
        `SELECT m.id, m.deleted_at FROM messages m
         WHERE m.id = ? AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`,
        [replyToId, senderId, receiverId, receiverId, senderId]
      );
      if (original.length === 0) throw new AppError('The message you are replying to was not found', 404);
      if (original[0].deleted_at) throw new AppError('You cannot reply to a deleted message', 400);
    }

    const [result] = await pool.query(
      `INSERT IGNORE INTO messages
         (sender_id, receiver_id, message_text, client_id, reply_to_id,
          attachment_path, attachment_name, attachment_type, attachment_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        senderId,
        receiverId,
        text,
        clientId,
        replyToId,
        file ? `uploads/messages/${file.filename}` : null,
        file ? cleanFileName(file.originalname) : null,
        file ? file.mimetype : null,
        file ? file.size : null,
      ]
    );

    if (result.affectedRows === 0) {
      // Duplicate (sender_id, client_id): return the message that was saved the first time.
      cleanup(); // the retry uploaded the same file again - throw the extra copy away
      const [existing] = await pool.query('SELECT id FROM messages WHERE sender_id = ? AND client_id = ?', [
        senderId,
        clientId,
      ]);
      if (existing.length === 0) throw new AppError('Could not save the message', 500);
      return { message: await getMessageById(existing[0].id), created: false };
    }

    return { message: await getMessageById(result.insertId), created: true };
  } catch (error) {
    if (file && !error.keepFile) cleanup();
    throw error;
  }
};

// Forwards one of my visible messages to up to 5 people. Each person gets their own copy.
export const forwardMessage = async (userId, rawMessageId, rawTargetIds) => {
  const messageId = parseUserId(rawMessageId);
  if (!Array.isArray(rawTargetIds) || rawTargetIds.length === 0) {
    throw new AppError('Choose at least one person to forward to', 400);
  }
  const targetIds = [...new Set(rawTargetIds.map(parseUserId))];
  if (targetIds.length > MAX_FORWARD_TARGETS) {
    throw new AppError(`You can forward to at most ${MAX_FORWARD_TARGETS} people at once`, 400);
  }
  if (targetIds.includes(userId)) throw new AppError('You cannot forward a message to yourself', 400);

  const original = await getVisibleRow(userId, messageId);
  if (original.deleted_at) throw new AppError('You cannot forward a deleted message', 400);

  const [users] = await pool.query('SELECT id FROM users WHERE id IN (?)', [targetIds]);
  if (users.length !== targetIds.length) throw new AppError('One of the selected users was not found', 404);

  const newIds = [];
  for (const targetId of targetIds) {
    const copiedPath = original.attachment_path ? await copyUploadedFile(original.attachment_path) : null;
    const [result] = await pool.query(
      `INSERT INTO messages
         (sender_id, receiver_id, message_text, is_forwarded,
          attachment_path, attachment_name, attachment_type, attachment_size)
       VALUES (?, ?, ?, TRUE, ?, ?, ?, ?)`,
      [
        userId,
        targetId,
        original.message_text,
        copiedPath,
        copiedPath ? original.attachment_name : null,
        copiedPath ? original.attachment_type : null,
        copiedPath ? original.attachment_size : null,
      ]
    );
    newIds.push(result.insertId);
  }

  const [rows] = await pool.query(`${SELECT_MESSAGE} WHERE m.id IN (?) ORDER BY m.id`, [newIds]);
  return withReactions(rows);
};

// ---------------------------------------------------------------------------
// Reading status
// ---------------------------------------------------------------------------

// Marks messages that otherUserId sent to readerId as read.
// Only the RECEIVER (readerId) can do this - the WHERE clause enforces it.
export const markConversationRead = async (readerId, otherUserId) => {
  const [result] = await pool.query(
    'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
    [otherUserId, readerId]
  );
  return result.affectedRows;
};

// ---------------------------------------------------------------------------
// Deleting
// ---------------------------------------------------------------------------

// "Delete for me": the message disappears only for this user. The other person still sees it.
export const deleteForMe = async (userId, rawMessageId) => {
  const row = await getVisibleRow(userId, parseUserId(rawMessageId));
  const column = row.sender_id === userId ? 'hidden_for_sender' : 'hidden_for_receiver'; // fixed names, not user input
  await pool.query(`UPDATE messages SET ${column} = TRUE WHERE id = ?`, [row.id]);
  return row;
};

// "Unsend": the sender removes the message for EVERYONE. The row stays (so replies still work)
// but the text, file and reactions are erased.
export const unsendMessage = async (userId, rawMessageId) => {
  const row = await getVisibleRow(userId, parseUserId(rawMessageId));
  if (row.sender_id !== userId) throw new AppError('You can only unsend your own messages', 403);

  if (!row.deleted_at) {
    await pool.query(
      `UPDATE messages
       SET message_text = '', attachment_path = NULL, attachment_name = NULL, attachment_type = NULL,
           attachment_size = NULL, is_forwarded = FALSE, deleted_at = NOW()
       WHERE id = ?`,
      [row.id]
    );
    await pool.query('DELETE FROM message_reactions WHERE message_id = ?', [row.id]);
    deleteUploadedFile(row.attachment_path);
  }
  return getMessageById(row.id);
};

// "Clear chat": hides every message of this conversation for me only.
export const clearChat = async (userId, otherId) => {
  const [a] = await pool.query(
    'UPDATE messages SET hidden_for_sender = TRUE WHERE sender_id = ? AND receiver_id = ? AND hidden_for_sender = FALSE',
    [userId, otherId]
  );
  const [b] = await pool.query(
    'UPDATE messages SET hidden_for_receiver = TRUE WHERE receiver_id = ? AND sender_id = ? AND hidden_for_receiver = FALSE',
    [userId, otherId]
  );
  return a.affectedRows + b.affectedRows;
};

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

// One reaction per person per message. Same emoji again = remove it. emoji = null removes it too.
export const setReaction = async (userId, rawMessageId, rawEmoji) => {
  const row = await getVisibleRow(userId, parseUserId(rawMessageId));
  if (row.deleted_at) throw new AppError('You cannot react to a deleted message', 400);

  const [current] = await pool.query('SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?', [
    row.id,
    userId,
  ]);

  if (rawEmoji === null || rawEmoji === undefined || rawEmoji === '') {
    await pool.query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [row.id, userId]);
  } else {
    if (typeof rawEmoji !== 'string') throw new AppError('Invalid reaction', 400);
    const emoji = REACTION_EMOJIS.find((e) => stripVariation(e) === stripVariation(rawEmoji));
    if (!emoji) throw new AppError('This reaction is not allowed', 400);

    if (current.length > 0 && current[0].emoji === emoji) {
      await pool.query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [row.id, userId]);
    } else {
      await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE emoji = VALUES(emoji)`,
        [row.id, userId, emoji]
      );
    }
  }

  return { row, reactions: await getReactions(row.id) };
};

// ---------------------------------------------------------------------------
// Real-time delivery helpers (each user has a Socket.IO "room" named user:<id>)
// ---------------------------------------------------------------------------
export const userRoom = (userId) => `user:${userId}`;

const bothRooms = (io, a, b) => io.to(userRoom(a)).to(userRoom(b));

// Sends a saved message to the receiver AND to the sender's other open tabs.
export const emitNewMessage = (io, message) => {
  if (!io) return;
  bothRooms(io, message.receiver_id, message.sender_id).emit('message:new', message);
};

// A message was unsent -> both people replace it with "This message was deleted".
export const emitMessageDeleted = (io, message) => {
  if (!io) return;
  bothRooms(io, message.receiver_id, message.sender_id).emit('message:deleted', { message });
  io.to(userRoom(message.receiver_id)).emit('unread:changed');
};

export const emitReaction = (io, row, reactions) => {
  if (!io) return;
  bothRooms(io, row.receiver_id, row.sender_id).emit('message:reaction', { message_id: row.id, reactions });
};

// "Delete for me" / "Clear chat": only the person who did it (all their open tabs) is told.
export const emitHidden = (io, userId, payload) => {
  if (!io) return;
  io.to(userRoom(userId)).emit('message:hidden', payload);
  io.to(userRoom(userId)).emit('unread:changed');
};

// Tells the original sender "your messages were seen by readerId".
export const emitMessagesRead = (io, readerId, otherUserId) => {
  if (!io) return;
  io.to(userRoom(otherUserId)).emit('message:read', { readerId });
  io.to(userRoom(readerId)).emit('unread:changed'); // other tabs of the reader refresh their badge
};
