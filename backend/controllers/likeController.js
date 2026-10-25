import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

const ensurePostExists = async (postId) => {
  const [rows] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
  if (rows.length === 0) throw new AppError('Post not found', 404);
};

const countLikes = async (postId) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM likes WHERE post_id = ?', [postId]);
  return Number(rows[0].total);
};

// POST /api/posts/:postId/like
export const likePost = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  // "INSERT IGNORE" + the UNIQUE(user_id, post_id) key means a second like is simply ignored.
  const [result] = await pool.query('INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)', [
    req.user.id,
    postId,
  ]);

  if (result.affectedRows === 0) {
    throw new AppError('You have already liked this post', 409);
  }

  res.status(201).json({ message: 'Post liked', liked: true, like_count: await countLikes(postId) });
};

// DELETE /api/posts/:postId/like
export const unlikePost = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  const [result] = await pool.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);

  if (result.affectedRows === 0) {
    throw new AppError('You have not liked this post', 409);
  }

  res.json({ message: 'Post unliked', liked: false, like_count: await countLikes(postId) });
};

// GET /api/posts/:postId/likes   -> who liked the post
export const getPostLikes = async (req, res) => {
  const { postId } = req.params;
  await ensurePostExists(postId);

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.profile_image, l.created_at
     FROM likes l
     JOIN users u ON u.id = l.user_id
     WHERE l.post_id = ?
     ORDER BY l.created_at DESC`,
    [postId]
  );

  res.json({
    like_count: rows.length,
    liked_by_me: rows.some((u) => u.id === req.user.id),
    users: rows,
  });
};
