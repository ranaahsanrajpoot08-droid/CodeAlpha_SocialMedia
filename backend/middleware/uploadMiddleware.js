// Handles image uploads with Multer.
// Profile pictures are saved in uploads/profiles, post images in uploads/posts.
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

// We decide the file extension from the mime type (not from the user's file name).
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const createUploader = (folder) => {
  const destination = path.join(uploadsRoot, folder);
  fs.mkdirSync(destination, { recursive: true }); // create folder if missing

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      cb(null, unique + ALLOWED_TYPES[file.mimetype]);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPG, PNG, GIF or WEBP images are allowed.', 400));
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });
};

// Use as middleware:  router.post('/', protect, uploadPostImage, createPost)
export const uploadPostImage = createUploader('posts').single('image');
export const uploadProfileImage = createUploader('profiles').single('profile_image');
