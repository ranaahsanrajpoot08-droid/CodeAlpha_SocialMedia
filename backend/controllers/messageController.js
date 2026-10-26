import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import {
  parseUserId,
  ensureUserExists,
  fetchThread,
  fetchConversations,
  getUnreadTotal,
  saveMessage,
  forwardMessage as forwardMessageService,
  markConversationRead,
  deleteForMe,
  unsendMessage,
  clearChat as clearChatService,
  setReaction,
  emitNewMessage,
  emitMessagesRead,
  emitMessageDeleted,
  emitReaction,
  emitHidden,
} from '../services/messageService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messageUploads = path.join(__dirname, '..', 'uploads', 'messages');

// GET /api/messages/conversations
// One row per person I have chatted with: last message + my unread count. Newest first.
export const getConversations = async (req, res) => {
  res.json({ conversations: await fetchConversations(req.user.id) });
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
  const before = parseInt(req.query.before, 10) || 0;

  const { messages, hasMore } = await fetchThread(me, otherId, { before, limit });
  res.json({ user: partner, messages, hasMore });
};

// POST /api/messages/:userId
// JSON:       { text, clientId?, replyToId? }
// multipart:  text, clientId, replyToId, attachment (a photo or file)
// Text-only messages normally go through the socket; this route is the fallback AND the way to send files.
export const sendMessage = async (req, res) => {
  const { message, created } = await saveMessage(req.user.id, req.params.userId, {
    text: req.body.text,
    clientId: req.body.clientId,
    replyToId: req.body.replyToId,
    file: req.file,
  });
  if (created) emitNewMessage(req.app.get('io'), message);
  res.status(created ? 201 : 200).json({ message });
};

// POST /api/messages/forward   body: { messageId, userIds: [1, 2] }
export const forwardMessage = async (req, res) => {
  const messages = await forwardMessageService(req.user.id, req.body.messageId, req.body.userIds);
  const io = req.app.get('io');
  messages.forEach((m) => emitNewMessage(io, m));
  res.status(201).json({ messages });
};

// DELETE /api/messages/item/:messageId?scope=me|everyone
//   me        -> hide it only for me
//   everyone  -> unsend (only the sender can do this)
export const deleteMessage = async (req, res) => {
  const io = req.app.get('io');
  const scope = req.query.scope;

  if (scope === 'everyone') {
    const message = await unsendMessage(req.user.id, req.params.messageId);
    emitMessageDeleted(io, message);
    return res.json({ message: 'Message unsent', scope, deleted: message });
  }
  if (scope === 'me') {
    const row = await deleteForMe(req.user.id, req.params.messageId);
    emitHidden(io, req.user.id, { ids: [row.id] });
    return res.json({ message: 'Message deleted for you', scope, id: row.id });
  }
  throw new AppError('scope must be "me" or "everyone"', 400);
};

// PUT /api/messages/item/:messageId/reaction   body: { emoji }   (same emoji again = remove)
export const reactToMessage = async (req, res) => {
  const { row, reactions } = await setReaction(req.user.id, req.params.messageId, req.body.emoji);
  emitReaction(req.app.get('io'), row, reactions);
  res.json({ message_id: row.id, reactions });
};

// DELETE /api/messages/chat/:userId   -> clear the whole chat for me only
export const clearChat = async (req, res) => {
  const otherId = parseUserId(req.params.userId);
  if (otherId === req.user.id) throw new AppError('You cannot message yourself', 400);
  await ensureUserExists(otherId);

  const cleared = await clearChatService(req.user.id, otherId);
  emitHidden(req.app.get('io'), req.user.id, { chatUserId: otherId });
  res.json({ message: 'Chat cleared', cleared });
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

// GET /uploads/messages/:file
// Serves a chat attachment. Images open in the browser, other files download with their ORIGINAL name.
// The address contains a long random part, so only people who were given it (the two chat members) can open it.
export const serveMessageFile = async (req, res) => {
  const file = req.params.file;
  if (!/^[A-Za-z0-9._-]+$/.test(file)) throw new AppError('File not found', 404);

  const [rows] = await pool.query(
    'SELECT attachment_name, attachment_type FROM messages WHERE attachment_path = ? LIMIT 1',
    [`uploads/messages/${file}`]
  );
  if (rows.length === 0) throw new AppError('File not found', 404);

  const fullPath = path.join(messageUploads, file);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const onError = (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
  };

  if (rows[0].attachment_type && rows[0].attachment_type.startsWith('image/')) {
    res.sendFile(fullPath, onError);
  } else {
    res.download(fullPath, rows[0].attachment_name || file, onError);
  }
};
