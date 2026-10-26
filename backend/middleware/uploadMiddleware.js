// Handles file uploads with Multer.
// Profile pictures -> uploads/profiles, post images -> uploads/posts,
// chat photos/files -> uploads/messages
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import AppError from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', 'uploads');

// We decide the file extension from the mime type (not from the user's file name).
const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// Chat attachments: images + common documents. (No .html, .svg, .js, .exe ... on purpose.)
const CHAT_TYPES = {
  ...IMAGE_TYPES,
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
};

const MB = 1024 * 1024;

// randomBytes = how long the random part of the file name is. Chat files use a longer one
// because their address is the only thing protecting them.
const createUploader = ({ folder, types, maxSize, fieldName, randomBytes, errorText }) => {
  const destination = path.join(uploadsRoot, folder);
  fs.mkdirSync(destination, { recursive: true }); // create folder if missing

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomBytes(randomBytes).toString('hex')}`;
      cb(null, unique + types[file.mimetype]);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (types[file.mimetype]) cb(null, true);
    else cb(new AppError(errorText, 400));
  };

  return multer({ storage, fileFilter, limits: { fileSize: maxSize, files: 1 } }).single(fieldName);
};

// Use as middleware:  router.post('/', protect, uploadPostImage, createPost)
export const uploadPostImage = createUploader({
  folder: 'posts',
  types: IMAGE_TYPES,
  maxSize: 5 * MB,
  fieldName: 'image',
  randomBytes: 6,
  errorText: 'Only JPG, PNG, GIF or WEBP images are allowed.',
});

export const uploadProfileImage = createUploader({
  folder: 'profiles',
  types: IMAGE_TYPES,
  maxSize: 5 * MB,
  fieldName: 'profile_image',
  randomBytes: 6,
  errorText: 'Only JPG, PNG, GIF or WEBP images are allowed.',
});

export const uploadMessageAttachment = createUploader({
  folder: 'messages',
  types: CHAT_TYPES,
  maxSize: 10 * MB,
  fieldName: 'attachment',
  randomBytes: 16,
  errorText: 'This file type is not allowed. Send an image, PDF, Word, Excel, PowerPoint, TXT, CSV or ZIP file.',
});
