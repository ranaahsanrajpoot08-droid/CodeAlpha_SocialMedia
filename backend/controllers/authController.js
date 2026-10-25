import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import generateToken from '../utils/generateToken.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

// Removes the password before sending a user to the frontend.
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  bio: u.bio,
  profile_image: u.profile_image,
  created_at: u.created_at,
});

// POST /api/auth/register
export const register = async (req, res) => {
  const name = (req.body.name || '').trim();
  const username = (req.body.username || '').trim().toLowerCase();
  const email = (req.body.email || '').trim().toLowerCase();
  const { password, confirmPassword } = req.body;

  // ---- Validation ----
  const errors = {};
  if (!name) errors.name = 'Name is required';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or less';

  if (!username) errors.username = 'Username is required';
  else if (!USERNAME_REGEX.test(username))
    errors.username = 'Username must be 3-30 characters (letters, numbers, underscore only)';

  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Please enter a valid email address';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    throw new AppError('Please fix the highlighted fields', 400, errors);
  }

  // ---- Unique username / email ----
  const [existing] = await pool.query('SELECT username, email FROM users WHERE username = ? OR email = ?', [
    username,
    email,
  ]);
  if (existing.length > 0) {
    const dupErrors = {};
    if (existing.some((u) => u.username === username)) dupErrors.username = 'Username is already taken';
    if (existing.some((u) => u.email === email)) dupErrors.email = 'Email is already registered';
    throw new AppError(Object.values(dupErrors)[0], 409, dupErrors);
  }

  // ---- Create user (password is hashed, never stored as plain text) ----
  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await pool.query('INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)', [
    name,
    username,
    email,
    hashedPassword,
  ]);

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

  res.status(201).json({
    message: 'Account created successfully',
    token: generateToken(result.insertId),
    user: publicUser(rows[0]),
  });
};

// POST /api/auth/login   body: { identifier, password }  (identifier = email OR username)
export const login = async (req, res) => {
  // Accept "identifier", "email" or "username" as the field name.
  const identifier = (req.body.identifier || req.body.email || req.body.username || '').trim().toLowerCase();
  const { password } = req.body;

  const errors = {};
  if (!identifier) errors.identifier = 'Email or username is required';
  if (!password) errors.password = 'Password is required';
  if (Object.keys(errors).length > 0) {
    throw new AppError('Please enter your email/username and password', 400, errors);
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
  if (rows.length === 0) {
    throw new AppError('No account found with that email or username', 401, {
      identifier: 'No account found with that email or username',
    });
  }

  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new AppError('Wrong password', 401, { password: 'Wrong password' });
  }

  res.json({
    message: 'Logged in successfully',
    token: generateToken(user.id),
    user: publicUser(user),
  });
};

// GET /api/auth/me   (needs token) - returns the currently logged-in user
export const getMe = async (req, res) => {
  res.json({ user: publicUser(req.user) });
};
