import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { deleteUploadedFile, toDbPath } from '../utils/files.js';

const MAX_CONTENT_LENGTH = 1000;

// Base query used by every "get posts" request.
// It joins the author and counts likes/comments.
// The first "?" is the id of the logged-in user (to know if THEY liked the post).
const POST_SELECT = `
  SELECT
    p.id, p.user_id, p.content, p.image, p.created_at, p.updated_at,
    u.name, u.username, u.profile_image,
    (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
    EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
  FROM posts p
  JOIN users u ON u.id = p.user_id
`;

// Turns a flat database row into a nice nested object for the frontend.
const formatPost = (row) => ({
  id: row.id,
  user_id: row.user_id,
  content: row.content,
  image: row.image,
  created_at: row.created_at,
  updated_at: row.updated_at,
  like_count: Number(row.like_count),
  comment_count: Number(row.comment_count),
  liked_by_me: Boolean(row.liked_by_me),
  user: {
    id: row.user_id,
    name: row.name,
    username: row.username,
    profile_image: row.profile_image,
  },
});

const getPostForUser = async (postId, viewerId) => {
  const [rows] = await pool.query(`${POST_SELECT} WHERE p.id = ?`, [viewerId, postId]);
  return rows.length ? formatPost(rows[0]) : null;
};

// GET /api/posts?page=1&limit=10&userId=3&filter=following
export const getPosts = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [req.user.id]; // first "?" in POST_SELECT

  // Only posts by one user (used on profile pages)
  if (req.query.userId) {
    conditions.push('p.user_id = ?');
    params.push(req.query.userId);
  }

  // Only posts from people I follow (and my own)
  if (req.query.filter === 'following') {
    conditions.push('(p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))');
    params.push(req.user.id, req.user.id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // We fetch one extra row to find out if there is another page.
  const [rows] = await pool.query(`${POST_SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, [
    ...params,
    limit + 1,
    offset,
  ]);

  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit).map(formatPost);

  res.json({ posts, page, hasMore });
};

// GET /api/posts/:id
export const getPostById = async (req, res) => {
  const post = await getPostForUser(req.params.id, req.user.id);
  if (!post) throw new AppError('Post not found', 404);
  res.json({ post });
};

// POST /api/posts   (multipart/form-data: content, image)
export const createPost = async (req, res) => {
  const content = (req.body.content || '').trim();

  if (!content && !req.file) {
    throw new AppError('A post needs some text or an image', 400, { content: 'Write something or add an image' });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new AppError(`Post must be ${MAX_CONTENT_LENGTH} characters or less`, 400, {
      content: `Post must be ${MAX_CONTENT_LENGTH} characters or less`,
    });
  }

  const [result] = await pool.query('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [
    req.user.id,
    content,
    toDbPath(req.file, 'posts'),
  ]);

  const post = await getPostForUser(result.insertId, req.user.id);
  res.status(201).json({ message: 'Post created', post });
};

// PUT /api/posts/:id   (only the owner)
export const updatePost = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Post not found', 404);

  const existing = rows[0];
  if (existing.user_id !== req.user.id) {
    throw new AppError('You can only edit your own posts', 403);
  }

  const content = (req.body.content !== undefined ? String(req.body.content) : existing.content).trim();
  const removeImage = req.body.remove_image === 'true';

  let image = existing.image;
  if (req.file) image = toDbPath(req.file, 'posts');
  else if (removeImage) image = null;

  if (!content && !image) {
    throw new AppError('A post needs some text or an image', 400, { content: 'Write something or add an image' });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new AppError(`Post must be ${MAX_CONTENT_LENGTH} characters or less`, 400, {
      content: `Post must be ${MAX_CONTENT_LENGTH} characters or less`,
    });
  }

  await pool.query('UPDATE posts SET content = ?, image = ? WHERE id = ?', [content, image, existing.id]);

  if (image !== existing.image) deleteUploadedFile(existing.image);

  const post = await getPostForUser(existing.id, req.user.id);
  res.json({ message: 'Post updated', post });
};

// DELETE /api/posts/:id   (only the owner)
export const deletePost = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new AppError('Post not found', 404);

  if (rows[0].user_id !== req.user.id) {
    throw new AppError('You can only delete your own posts', 403);
  }

  // Comments and likes are removed automatically (ON DELETE CASCADE in the database).
  await pool.query('DELETE FROM posts WHERE id = ?', [rows[0].id]);
  deleteUploadedFile(rows[0].image);

  res.json({ message: 'Post deleted' });
};
