// All API calls live in this one file.
// Components never write URLs themselves - they just call these functions.
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// The server address WITHOUT "/api" (used to show uploaded images).
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

const api = axios.create({ baseURL: API_URL });

// Attach the login token to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server says "401 Unauthorized" (expired/invalid token), log the user out.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthForm) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Turns any error into a friendly message for the user.
export const getErrorMessage = (error) => {
  if (error.response) return error.response.data?.message || 'Something went wrong. Please try again.';
  if (error.request) return 'Network error. Check that the backend server is running on port 5000.';
  return error.message || 'Something went wrong.';
};

// Field-level validation errors from the server, e.g. { username: 'Already taken' }
export const getFieldErrors = (error) => error.response?.data?.errors || {};

// ---------- Auth ----------
export const registerUser = (data) => api.post('/auth/register', data).then((r) => r.data);
export const loginUser = (data) => api.post('/auth/login', data).then((r) => r.data);
export const fetchMe = () => api.get('/auth/me').then((r) => r.data);

// ---------- Users ----------
export const fetchUser = (id) => api.get(`/users/${id}`).then((r) => r.data);
export const updateProfile = (id, formData) => api.put(`/users/${id}`, formData).then((r) => r.data);
export const searchUsers = (q) => api.get('/users/search', { params: { q } }).then((r) => r.data);
export const fetchSuggestions = () => api.get('/users/suggestions').then((r) => r.data);

// ---------- Posts ----------
export const fetchPosts = (params) => api.get('/posts', { params }).then((r) => r.data);
export const createPost = (formData) => api.post('/posts', formData).then((r) => r.data);
export const updatePost = (id, formData) => api.put(`/posts/${id}`, formData).then((r) => r.data);
export const deletePost = (id) => api.delete(`/posts/${id}`).then((r) => r.data);

// ---------- Likes ----------
export const likePost = (postId) => api.post(`/posts/${postId}/like`).then((r) => r.data);
export const unlikePost = (postId) => api.delete(`/posts/${postId}/like`).then((r) => r.data);

// ---------- Comments ----------
export const fetchComments = (postId) => api.get(`/posts/${postId}/comments`).then((r) => r.data);
export const addComment = (postId, comment, parentId) =>
  api.post(`/posts/${postId}/comments`, { comment, parentId }).then((r) => r.data);
export const deleteComment = (id) => api.delete(`/comments/${id}`).then((r) => r.data);
export const likeComment = (id) => api.post(`/comments/${id}/like`).then((r) => r.data);
export const unlikeComment = (id) => api.delete(`/comments/${id}/like`).then((r) => r.data);

// ---------- Follows ----------
export const followUser = (id) => api.post(`/users/${id}/follow`).then((r) => r.data);
export const unfollowUser = (id) => api.delete(`/users/${id}/follow`).then((r) => r.data);
export const fetchFollowers = (id) => api.get(`/users/${id}/followers`).then((r) => r.data);
export const fetchFollowing = (id) => api.get(`/users/${id}/following`).then((r) => r.data);

// ---------- Messages ----------
export const fetchConversations = () => api.get('/messages/conversations').then((r) => r.data);
export const fetchUnreadCount = () => api.get('/messages/unread-count').then((r) => r.data);
export const fetchMessages = (userId, params) => api.get(`/messages/${userId}`, { params }).then((r) => r.data);
export const sendMessageRest = (userId, data) => api.post(`/messages/${userId}`, data).then((r) => r.data);
export const markMessagesRead = (userId) => api.patch(`/messages/${userId}/read`).then((r) => r.data);
// scope = 'me' (delete for me) or 'everyone' (unsend)
export const deleteMessage = (id, scope) => api.delete(`/messages/item/${id}`, { params: { scope } }).then((r) => r.data);
export const reactToMessage = (id, emoji) => api.put(`/messages/item/${id}/reaction`, { emoji }).then((r) => r.data);
export const forwardMessage = (messageId, userIds) => api.post('/messages/forward', { messageId, userIds }).then((r) => r.data);
export const clearChat = (userId) => api.delete(`/messages/chat/${userId}`).then((r) => r.data);

export default api;
