# SocialConnect - Mini Social Media Platform

React + Vite (frontend) | Node.js + Express (backend) | MySQL via XAMPP (database)

## 1. Requirements
- XAMPP (Apache + MySQL) - https://www.apachefriends.org
- Node.js 18 or newer (LTS) - https://nodejs.org   (check: `node -v`)

## 2. Database (XAMPP)
1. Open **XAMPP Control Panel** -> click **Start** next to **MySQL** (also start **Apache** so phpMyAdmin opens).
2. Open http://localhost/phpmyadmin
3. Click **Import** (top menu) -> **Choose file** -> select `backend/database.sql` -> click **Import** (bottom).
4. You should now see the database `social_media_app` with 5 tables: users, posts, comments, likes, follows.

## 3. Backend (Terminal 1)
```powershell
cd backend
npm install
npm run dev
```
Expected output:
```
Server running on http://localhost:5000
Connected to MySQL database: social_media_app
```
`backend/.env` already contains XAMPP's defaults (user `root`, empty password, port 3306).

## 4. Frontend (Terminal 2)
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## 5. Test accounts (password for all: `password123`)
| Username | Email             |
|----------|-------------------|
| ali      | ali@example.com   |
| ahmed    | ahmed@example.com |
| sara     | sara@example.com  |

You can log in with the username OR the email.

## 6. Production build
```powershell
cd frontend
npm run build      # creates frontend/dist
npm run preview    # preview the build locally
```
For the backend in production set `NODE_ENV=production`, a long random `JWT_SECRET`, and `CLIENT_URL` to your real frontend address, then run `npm start`.

## 7. Common problems
| Problem | Fix |
|---|---|
| `Could not connect to MySQL` / ECONNREFUSED | Start MySQL in XAMPP Control Panel. |
| `Unknown database social_media_app` | Import `backend/database.sql` in phpMyAdmin. |
| `Access denied for user root` | Your MySQL has a password: put it in `DB_PASSWORD` in `backend/.env`. |
| MySQL won't start (port 3306 busy) | Stop other MySQL services, or change the port in XAMPP and `DB_PORT` in `.env`. |
| `Network error` in browser | Backend is not running (Terminal 1) or runs on another port. |
| `EADDRINUSE: port 5000` | Another app uses port 5000. Change `PORT` in `backend/.env` and `VITE_API_URL` in `frontend/.env`, restart both. |
| CORS error | `CLIENT_URL` in `backend/.env` must match the address shown by Vite (default http://localhost:5173). |
| Images not showing | Backend must be running; check `backend/uploads/` exists. |
| `npm` scripts blocked in PowerShell | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Changed `.env` but nothing changed | Stop and restart the backend / frontend. |

## 10. Messaging (real-time chat)
- **Already have the database?** Do NOT re-import `database.sql` (it resets everything). Import `backend/migrations/001_add_messages.sql` instead - it only adds the `messages` table.
- Install the new packages once: `cd backend` -> `npm install` and `cd frontend` -> `npm install`.
- Open **Messages** in the navbar, or open a user's profile and press **Message**.
- Enter = send, Shift+Enter = new line. Max 1000 characters per message.
- Socket.IO runs on the same port as the API (5000). No extra server is needed.

## 8. API endpoints (all except auth/register and auth/login need `Authorization: Bearer <token>`)
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Users: `GET /api/users/:id`, `PUT /api/users/:id`, `GET /api/users/search?q=`, `GET /api/users/suggestions`
- Posts: `GET /api/posts`, `GET /api/posts/:id`, `POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id`
- Comments: `GET|POST /api/posts/:postId/comments`, `DELETE /api/comments/:id`
- Likes: `POST|DELETE /api/posts/:postId/like`, `GET /api/posts/:postId/likes`
- Messages: `GET /api/messages/conversations`, `GET /api/messages/unread-count`, `GET /api/messages/:userId`, `POST /api/messages/:userId`, `PATCH /api/messages/:userId/read`
- Follows: `POST|DELETE /api/users/:id/follow`, `GET /api/users/:id/follow-status`, `GET /api/users/:id/followers`, `GET /api/users/:id/following`

## 9. Folder structure
```
social-media-app/
  backend/   config/ controllers/ middleware/ routes/ utils/ uploads/ database.sql server.js .env
  frontend/  src/{components,pages,context,services,routes,styles,utils} index.html vite.config.js .env
```
