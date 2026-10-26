import { SERVER_URL } from '../services/api.js';

// Full URL of an uploaded image (or null when there is none).
export const imageUrl = (path) => (path ? `${SERVER_URL}/${path}` : null);

// "5 minutes ago", "2 days ago" ...
export const timeAgo = (dateString) => {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fullDate = (dateString) => new Date(dateString).toLocaleString();

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

// Inbox time: "14:05" today, "Yesterday", otherwise "Oct 9".
export const formatChatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  if (isSameDay(date, now)) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Message bubble time: "14:05" today, "Oct 9, 14:05" for older messages.
export const formatMessageTime = (dateString) => {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isSameDay(date, new Date()) ? time : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
};

// "12 KB", "3.4 MB"
export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// One-line text for the inbox / reply quotes. Works for a message or an inbox "last_message".
export const messagePreview = (m) => {
  if (!m) return '';
  if (m.is_deleted) return '🚫 This message was deleted';
  const text = m.message_text || '';
  if (m.attachment) {
    const label = m.attachment.is_image ? '📷 Photo' : `📎 ${m.attachment.name}`;
    return text ? `${label} ${text}` : label;
  }
  return text;
};
