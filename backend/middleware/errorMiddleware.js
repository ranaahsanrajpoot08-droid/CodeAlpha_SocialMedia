import multer from 'multer';
import { deleteUploadedFile } from '../utils/files.js';

// Runs when no route matched the request.
export const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// The ONE place where all errors become JSON responses.
// Any error thrown in a controller or middleware ends up here.
// (Express 5 automatically forwards errors from async functions.)
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors || null;

  // If an image was uploaded but the request failed, remove the orphan file.
  if (req.file) {
    const folder = req.file.destination.split(/[\\/]/).pop();
    deleteUploadedFile(`uploads/${folder}/${req.file.filename}`);
  }

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large. Maximum size is 5MB.' : err.message;
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    const text = String(err.sqlMessage || '');
    if (text.includes('username')) {
      message = 'Username is already taken';
      errors = { username: message };
    } else if (text.includes('email')) {
      message = 'Email is already registered';
      errors = { email: message };
    } else {
      message = 'This record already exists';
    }
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body';
  } else if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(err.code)) {
    status = 503;
    message = 'Database is not available. Make sure MySQL is running in XAMPP.';
  } else if (err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
    status = 503;
    message = 'Database is not set up. Import database.sql in phpMyAdmin.';
  } else if (!err.isOperational && status === 500) {
    // Unknown error: log it for the developer, hide details from the user.
    console.error('💥 Unexpected error:', err);
    message = process.env.NODE_ENV === 'production' ? 'Server error' : `Server error: ${err.message}`;
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  res.status(status).json(body);
};
