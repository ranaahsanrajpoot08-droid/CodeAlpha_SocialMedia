import pool from '../config/db.js';
import {
  formatMessage,
  parseUserId,
  ensureUserExists,
  saveMessage,
  markConversationRead,
  getUnreadTotal,
  emitNewMessage,
  emitMessagesRead,
} from '../services/messageService.js';
import AppError from '../utils/AppError.js';

// GET /api/messages/conversations
// One row per person I have chatted with: last message + my unread count. Newest first.
export const getConversations = async (req, res) => {
  const me = req.user.id;

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.profile_image,
            m.id AS last_id, m.sender_id AS last_sender_id, m.message_text AS last_text, m.created_at AS last_at,
            (SELECT COUNT(*) FROM messages
               WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) AS unread_count
     FROM users u
     JOIN messages m ON m.id = (
       SELECT MAX(id) FROM messages
       WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
     )
     WHERE u.id <> ?
     ORDER BY m.id DESC`,
    [me, me, me, me]
  );

  res.json({
    conversations: rows.map((r) => ({
      user: { id: r.id, name: r.name, username: r.username, profile_image: r.profile_image },
      last_message: {
        id: r.last_id,
        sender_id: r.last_sender_id,
        message_text: r.last_text,
        created_at: r.last_at,
      },
      unread_count: Number(r.unread_count),
    })),
  });
};

// GET /api/messages/unread-count
export const getUnreadCount = async (req, res) => {
  res.json({ unread_count: await getUnreadTotal(req.user.id) });
};

// GET /api/messages/:userId?before=<messageId>&limit=30
// Only returns messages between ME and :userId, so nobody can read other people's chats.
export const getMessages = async (req, res) => {
  const me = req.user.id;
  const otherId = parseUserId(req.params.userId);
  if (otherId === me) throw new AppError('You cannot message yourself', 400);

  const partner = await ensureUserExists(otherId);

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  const before = parseInt(req.query.before, 10);

  const params = [me, otherId, otherId, me];
  let beforeSql = '';
  if (before > 0) {
    beforeSql = 'AND id < ?';
    params.push(before);
  }

  const [rows] = await pool.query(
    `SELECT * FROM messages
     WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) ${beforeSql}
     ORDER BY id DESC
     LIMIT ?`,
    [...params, limit + 1]
  );

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(formatMessage); // oldest -> newest

  res.json({ user: partner, messages, hasMore });
};

// POST /api/messages/:userId   body: { text, clientId? }
// Same as sending through the socket - useful as a fallback when the socket is disconnected.
export const sendMessage = async (req, res) => {
  const { message, created } = await saveMessage(req.user.id, req.params.userId, req.body.text, req.body.clientId);
  if (created) emitNewMessage(req.app.get('io'), message);
  res.status(created ? 201 : 200).json({ message });
};

// PATCH /api/messages/:userId/read   -> I have read everything that :userId sent me
export const markRead = async (req, res) => {
  const me = req.user.id;
  const otherId = parseUserId(req.params.userId);
  if (otherId === me) throw new AppError('You cannot message yourself', 400);

  const updated = await markConversationRead(me, otherId);
  if (updated > 0) emitMessagesRead(req.app.get('io'), me, otherId);

  res.json({ updated, unread_count: await getUnreadTotal(me) });
};
