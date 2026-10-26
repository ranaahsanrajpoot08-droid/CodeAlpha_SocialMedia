// SocialConnect backend - entry point.
// Run with:  npm run dev   (auto-restarts when you change a file)
import dotenv from 'dotenv';
dotenv.config(); // must run before we read process.env anywhere else

import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

import { testConnection } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import likeRoutes from './routes/likeRoutes.js';
import followRoutes from './routes/followRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { serveMessageFile } from './controllers/messageController.js';
import { initSocket } from './sockets/socketHandler.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is missing. Add it to backend/.env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');

// ---- Middleware ----
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .concat(['http://127.0.0.1:5173']);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow tools like Postman (no origin) and our React app
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked request from ${origin}`));
    },
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploaded images are available at  http://localhost:5000/uploads/...
// Chat files are served by their own route (images open, other files download with their real name).
app.get('/uploads/messages/:file', serveMessageFile);
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'SocialConnect API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', commentRoutes); // /api/posts/:postId/comments and /api/comments/:id
app.use('/api', likeRoutes); // /api/posts/:postId/like(s)
app.use('/api', followRoutes); // /api/users/:id/follow, followers, following
app.use('/api/messages', messageRoutes); // private messaging

// ---- Errors (must be LAST) ----
app.use(notFound);
app.use(errorHandler);

// Express and Socket.IO share ONE http server (so one port: 5000).
const server = http.createServer(app);
const io = initSocket(server, allowedOrigins);
app.set('io', io); // lets REST controllers push real-time events too

server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await testConnection();
});
