import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar.jsx';
import Loading from './Loading.jsx';
import { fetchFollowing } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { messagePreview } from '../utils/helpers.js';

const MAX_TARGETS = 5;

// Pop-up to choose who to forward a message to (people you chat with + people you follow).
const ForwardModal = ({ message, conversations, onClose, onSubmit }) => {
  const { user: me } = useAuth();
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFollowing(me.id)
      .then((data) => setFollowing(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [me.id]);

  // chats first, then people I follow (no duplicates, never myself)
  const people = useMemo(() => {
    const list = [];
    const seen = new Set([me.id]);
    [...conversations.map((c) => c.user), ...following].forEach((u) => {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        list.push(u);
      }
    });
    return list;
  }, [conversations, following, me.id]);

  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) : people;

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_TARGETS) return prev;
      return [...prev, id];
    });
  };

  const submit = async () => {
    setSending(true);
    try {
      await onSubmit(selected);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Forward message" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Forward message</h3>
          <button className="chat-back" style={{ display: 'block' }} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="forward-preview">{messagePreview(message) || 'Message'}</div>

        <input
          type="search"
          placeholder="Search people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="forward-list">
          {loading && <Loading />}
          {!loading && shown.length === 0 && (
            <p className="muted small center">
              No people found. You can forward to people you chat with or follow.
            </p>
          )}
          {shown.map((u) => (
            <label key={u.id} className={`forward-item ${selected.includes(u.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                disabled={!selected.includes(u.id) && selected.length >= MAX_TARGETS}
              />
              <Avatar user={u} size={36} />
              <div className="forward-name">
                <strong>{u.name}</strong>
                <span className="muted small">@{u.username}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <span className="muted small">{selected.length}/{MAX_TARGETS} selected</span>
          <span className="spacer" />
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={selected.length === 0 || sending}>
            {sending ? 'Sending...' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
