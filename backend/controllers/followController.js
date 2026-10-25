import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

const ensureUserExists = async (userId) => {
  const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) throw new AppError('User not found', 404);
};

const getCounts = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
       (SELECT COUNT(*) FROM follows WHERE follower_id = ?)  AS following_count`,
    [userId, userId]
  );
  return {
    followers_count: Number(rows[0].followers_count),
    following_count: Number(rows[0].following_count),
  };
};

// POST /api/users/:id/follow
export const followUser = async (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.user.id) {
    throw new AppError('You cannot follow yourself', 400);
  }
  await ensureUserExists(targetId);

  // UNIQUE(follower_id, following_id) + INSERT IGNORE prevents duplicates.
  const [result] = await pool.query('INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', [
    req.user.id,
    targetId,
  ]);
  if (result.affectedRows === 0) {
    throw new AppError('You are already following this user', 409);
  }

  res.status(201).json({ message: 'User followed', is_following: true, ...(await getCounts(targetId)) });
};

// DELETE /api/users/:id/follow
export const unfollowUser = async (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.user.id) {
    throw new AppError('You cannot unfollow yourself', 400);
  }
  await ensureUserExists(targetId);

  const [result] = await pool.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [
    req.user.id,
    targetId,
  ]);
  if (result.affectedRows === 0) {
    throw new AppError('You are not following this user', 409);
  }

  res.json({ message: 'User unfollowed', is_following: false, ...(await getCounts(targetId)) });
};

// GET /api/users/:id/follow-status   -> am I following this user?
export const getFollowStatus = async (req, res) => {
  const targetId = Number(req.params.id);
  await ensureUserExists(targetId);

  const [rows] = await pool.query('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [
    req.user.id,
    targetId,
  ]);
  res.json({ is_following: rows.length > 0 });
};

// GET /api/users/:id/followers
export const getFollowers = async (req, res) => {
  const targetId = Number(req.params.id);
  await ensureUserExists(targetId);

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.bio, u.profile_image,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ?
     ORDER BY f.created_at DESC`,
    [req.user.id, targetId]
  );

  res.json({
    count: rows.length,
    users: rows.map((u) => ({ ...u, is_following: Boolean(u.is_following) })),
  });
};

// GET /api/users/:id/following
export const getFollowing = async (req, res) => {
  const targetId = Number(req.params.id);
  await ensureUserExists(targetId);

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.bio, u.profile_image,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ?
     ORDER BY f.created_at DESC`,
    [req.user.id, targetId]
  );

  res.json({
    count: rows.length,
    users: rows.map((u) => ({ ...u, is_following: Boolean(u.is_following) })),
  });
};
