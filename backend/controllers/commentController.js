import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

const MAX_COMMENT_LENGTH = 500;

// The first "?" is the id of the logged-in user (to know if THEY liked the comment).
const COMMENT_SELECT = `
  SELECT c.id, c.post_id, c.user_id, c.parent_id, c.comment, c.created_at, c.updated_at,
         u.name, u.username, u.profile_image,
         (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS like_count,
         EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) AS liked_by_me
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

const formatComment = (row) => ({
  id: row.id,
  post_id: row.post_id,
  user_id: row.user_id,
  parent_id: row.parent_id, // null = normal comment, a number = reply to that comment
  comment: row.comment,
  created_at: row.created_at,
  updated_at: row.updated_at,
  like_count: Number(row.like_count),
  liked_by_me: Boolean(row.liked_by_me),
  user: {
    id: row.user_id,
    name: row.name,
    username: row.username,
    profile_image: row.profile_image,
  },
});

const ensurePostExists = async (postId) => {
  const [rows] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
  if (rows.length === 0) throw new AppError('Post not found', 404);
};

const countCommentLikes = async (commentId) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM comment_likes WHERE comment_id = ?', [commentId]);
  return Number(rows[0].total);
};

// GET /api/posts/:postId/comments   (oldest first, like a conversation)
export const getComments = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`, [
    req.user.id,
    postId,
  ]);
  res.json({ comments: rows.map(formatComment), count: rows.length });
};

// POST /api/posts/:postId/comments   body: { comment, parentId? }
// parentId = the comment you are replying to. Replies to a reply are placed under the
// original comment (one level of replies, like Instagram / YouTube).
export const addComment = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  const comment = String(req.body.comment || '').trim();
  if (!comment) {
    throw new AppError('Comment cannot be empty', 400, { comment: 'Comment cannot be empty' });
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new AppError(`Comment must be ${MAX_COMMENT_LENGTH} characters or less`, 400, {
      comment: `Comment must be ${MAX_COMMENT_LENGTH} characters or less`,
    });
  }

  let parentId = null;
  if (req.body.parentId !== undefined && req.body.parentId !== null && req.body.parentId !== '') {
    const [parents] = await pool.query('SELECT id, post_id, parent_id FROM comments WHERE id = ?', [
      Number(req.body.parentId),
    ]);
    if (parents.length === 0) throw new AppError('The comment you are replying to was not found', 404);
    if (String(parents[0].post_id) !== String(postId)) {
      throw new AppError('That comment belongs to a different post', 400);
    }
    parentId = parents[0].parent_id || parents[0].id; // replying to a reply -> attach to the top comment
  }

  const [result] = await pool.query('INSERT INTO comments (user_id, post_id, parent_id, comment) VALUES (?, ?, ?, ?)', [
    req.user.id,
    postId,
    parentId,
    comment,
  ]);

  const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [req.user.id, result.insertId]);
  res.status(201).json({ message: parentId ? 'Reply added' : 'Comment added', comment: formatComment(rows[0]) });
};

// DELETE /api/comments/:id   (only the person who wrote it). Replies under it are deleted too.
export const deleteComment = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Comment not found', 404);

  if (rows[0].user_id !== req.user.id) {
    throw new AppError('You can only delete your own comments', 403);
  }

  const [replies] = await pool.query('SELECT COUNT(*) AS total FROM comments WHERE parent_id = ?', [rows[0].id]);
  await pool.query('DELETE FROM comments WHERE id = ?', [rows[0].id]); // replies go too (ON DELETE CASCADE)

  res.json({
    message: 'Comment deleted',
    post_id: rows[0].post_id,
    deleted_count: 1 + Number(replies[0].total),
  });
};

// POST /api/comments/:id/like
export const likeComment = async (req, res) => {
  const [rows] = await pool.query('SELECT id FROM comments WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Comment not found', 404);

  // UNIQUE(user_id, comment_id) + INSERT IGNORE: liking twice is simply ignored.
  await pool.query('INSERT IGNORE INTO comment_likes (user_id, comment_id) VALUES (?, ?)', [req.user.id, rows[0].id]);
  res.json({ liked: true, like_count: await countCommentLikes(rows[0].id) });
};

// DELETE /api/comments/:id/like
export const unlikeComment = async (req, res) => {
  const [rows] = await pool.query('SELECT id FROM comments WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Comment not found', 404);

  await pool.query('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [req.user.id, rows[0].id]);
  res.json({ liked: false, like_count: await countCommentLikes(rows[0].id) });
};
