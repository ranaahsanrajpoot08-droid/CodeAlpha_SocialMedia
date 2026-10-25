import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

const MAX_COMMENT_LENGTH = 500;

const COMMENT_SELECT = `
  SELECT c.id, c.post_id, c.user_id, c.comment, c.created_at, c.updated_at,
         u.name, u.username, u.profile_image
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

const formatComment = (row) => ({
  id: row.id,
  post_id: row.post_id,
  user_id: row.user_id,
  comment: row.comment,
  created_at: row.created_at,
  updated_at: row.updated_at,
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

// GET /api/posts/:postId/comments   (oldest first, like a conversation)
export const getComments = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`, [
    postId,
  ]);
  res.json({ comments: rows.map(formatComment), count: rows.length });
};

// POST /api/posts/:postId/comments   body: { comment }
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

  const [result] = await pool.query('INSERT INTO comments (user_id, post_id, comment) VALUES (?, ?, ?)', [
    req.user.id,
    postId,
    comment,
  ]);

  const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [result.insertId]);
  res.status(201).json({ message: 'Comment added', comment: formatComment(rows[0]) });
};

// DELETE /api/comments/:id   (only the person who wrote it)
export const deleteComment = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Comment not found', 404);

  if (rows[0].user_id !== req.user.id) {
    throw new AppError('You can only delete your own comments', 403);
  }

  await pool.query('DELETE FROM comments WHERE id = ?', [rows[0].id]);
  res.json({ message: 'Comment deleted', post_id: rows[0].post_id });
};
