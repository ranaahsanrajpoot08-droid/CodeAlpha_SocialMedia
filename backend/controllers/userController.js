import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { deleteUploadedFile, toDbPath } from '../utils/files.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

// SQL snippet that gives us the counts shown on a profile.
// "?" is replaced by the id of the person who is looking at the profile.
const PROFILE_QUERY = `
  SELECT
    u.id, u.name, u.username, u.bio, u.profile_image, u.created_at,
    (SELECT COUNT(*) FROM posts   WHERE user_id = u.id)        AS posts_count,
    (SELECT COUNT(*) FROM follows WHERE following_id = u.id)   AS followers_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)    AS following_count,
    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
  FROM users u
`;

const formatProfile = (row) => ({
  id: row.id,
  name: row.name,
  username: row.username,
  bio: row.bio,
  profile_image: row.profile_image,
  created_at: row.created_at,
  posts_count: Number(row.posts_count),
  followers_count: Number(row.followers_count),
  following_count: Number(row.following_count),
  is_following: Boolean(row.is_following),
});

// GET /api/users/:id
export const getUserById = async (req, res) => {
  const [rows] = await pool.query(`${PROFILE_QUERY} WHERE u.id = ?`, [req.user.id, req.params.id]);
  if (rows.length === 0) throw new AppError('User not found', 404);
  res.json({ user: formatProfile(rows[0]) });
};

// PUT /api/users/:id   (multipart/form-data: name, username, bio, profile_image)
export const updateUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (userId !== req.user.id) {
    throw new AppError('You can only edit your own profile', 403);
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) throw new AppError('User not found', 404);
  const current = rows[0];

  // Use the new value if one was sent, otherwise keep the old one.
  const name = req.body.name !== undefined ? req.body.name.trim() : current.name;
  const username = req.body.username !== undefined ? req.body.username.trim().toLowerCase() : current.username;
  const bio = req.body.bio !== undefined ? req.body.bio.trim() : current.bio;

  const errors = {};
  if (!name) errors.name = 'Name is required';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or less';
  if (!username) errors.username = 'Username is required';
  else if (!USERNAME_REGEX.test(username))
    errors.username = 'Username must be 3-30 characters (letters, numbers, underscore only)';
  if (bio && bio.length > 300) errors.bio = 'Bio must be 300 characters or less';
  if (Object.keys(errors).length > 0) {
    throw new AppError('Please fix the highlighted fields', 400, errors);
  }

  // Username must stay unique
  if (username !== current.username) {
    const [taken] = await pool.query('SELECT id FROM users WHERE username = ? AND id <> ?', [username, userId]);
    if (taken.length > 0) {
      throw new AppError('Username is already taken', 409, { username: 'Username is already taken' });
    }
  }

  // Profile picture: new upload replaces the old one
  let profileImage = current.profile_image;
  if (req.file) {
    profileImage = toDbPath(req.file, 'profiles');
  } else if (req.body.remove_image === 'true') {
    profileImage = null;
  }

  await pool.query('UPDATE users SET name = ?, username = ?, bio = ?, profile_image = ? WHERE id = ?', [
    name,
    username,
    bio || null,
    profileImage,
    userId,
  ]);

  if (profileImage !== current.profile_image) {
    deleteUploadedFile(current.profile_image); // clean up old picture
  }

  const [updated] = await pool.query(`${PROFILE_QUERY} WHERE u.id = ?`, [req.user.id, userId]);
  res.json({
    message: 'Profile updated successfully',
    user: { ...formatProfile(updated[0]), email: current.email },
  });
};

// GET /api/users/search?q=ali
export const searchUsers = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });
  if (q.length > 50) throw new AppError('Search text is too long', 400);

  // Escape the LIKE wildcards so "%" and "_" are searched literally.
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.bio, u.profile_image,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
     FROM users u
     WHERE u.username LIKE ? OR u.name LIKE ?
     ORDER BY (u.username = ?) DESC, u.username ASC
     LIMIT 30`,
    [req.user.id, like, like, q.toLowerCase()]
  );

  res.json({
    users: rows.map((u) => ({ ...u, is_following: Boolean(u.is_following) })),
  });
};

// GET /api/users/suggestions   -> people the current user does not follow yet
export const getSuggestedUsers = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.username, u.bio, u.profile_image, 0 AS is_following
     FROM users u
     WHERE u.id <> ?
       AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
     ORDER BY u.created_at DESC
     LIMIT 5`,
    [req.user.id, req.user.id]
  );
  res.json({ users: rows.map((u) => ({ ...u, is_following: false })) });
};
