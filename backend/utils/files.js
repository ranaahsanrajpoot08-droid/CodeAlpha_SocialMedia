import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

// Deletes an uploaded file (e.g. "uploads/posts/abc.jpg") from disk.
// Fails silently - a missing file should never crash the API.
export const deleteUploadedFile = (relativePath) => {
  if (!relativePath) return;
  // Safety: only ever delete files inside the uploads folder.
  const fullPath = path.join(backendRoot, relativePath);
  const uploadsRoot = path.join(backendRoot, 'uploads');
  if (!fullPath.startsWith(uploadsRoot)) return;
  fs.unlink(fullPath, () => {});
};

// Converts a multer file object into the path we store in the database.
export const toDbPath = (file, folder) => (file ? `uploads/${folder}/${file.filename}` : null);

// Makes a separate copy of an uploaded file and returns the new path (used when forwarding a message,
// so the forwarded copy keeps working even if the original is unsent later).
export const copyUploadedFile = async (relativePath) => {
  if (!relativePath) return null;
  const uploadsRoot = path.join(backendRoot, 'uploads');
  const source = path.join(backendRoot, relativePath);
  if (!source.startsWith(uploadsRoot)) return null;

  const folder = path.posix.dirname(relativePath.replace(/\\/g, '/'));
  const newName = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${path.extname(source)}`;
  const newRelative = `${folder}/${newName}`;
  await fs.promises.copyFile(source, path.join(backendRoot, newRelative));
  return newRelative;
};
