import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';

// Protects a route: the request must contain a valid JWT token.
// The frontend sends it in the header:   Authorization: Bearer <token>
export const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Not authorized. Please log in.', 401);
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new AppError('Your session has expired or is invalid. Please log in again.', 401);
  }

  // Make sure the user still exists in the database.
  const [rows] = await pool.query(
    'SELECT id, name, username, email, bio, profile_image, created_at FROM users WHERE id = ?',
    [decoded.id]
  );

  if (rows.length === 0) {
    throw new AppError('This account no longer exists. Please log in again.', 401);
  }

  req.user = rows[0]; // password is never selected, so it can never leak
  next();
};
