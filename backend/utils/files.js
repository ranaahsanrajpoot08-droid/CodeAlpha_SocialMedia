import fs from 'fs';
import path from 'path';
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
