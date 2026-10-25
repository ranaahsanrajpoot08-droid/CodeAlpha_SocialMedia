import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Loading from './Loading.jsx';
import { formatChatTime } from '../utils/helpers.js';

// Left side of the Messages page: everyone I have chatted with, newest first.
const ConversationList = ({ conversations, activeId, loading, error, onRetry, myId }) => (
  <aside className="conv-panel">
    <div className="conv-header">
      <h2>Messages</h2>
    </div>

    <div className="conv-scroll">
      {loading && <Loading text="Loading chats..." />}

      {!loading && error && (
        <div className="alert alert-error">
          {error} <button className="link-btn" onClick={onRetry}>Try again</button>
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="conv-empty">
          <p><strong>No conversations yet</strong></p>
          <p className="muted small">Open someone's profile and press <b>Message</b> to start chatting.</p>
          <Link to="/search" className="btn btn-outline">Find people</Link>
        </div>
      )}

      {conversations.map((c) => {
        const mine = c.last_message.sender_id === myId;
        return (
          <Link
            key={c.user.id}
            to={`/messages/${c.user.id}`}
            className={`conv-item ${c.user.id === activeId ? 'active' : ''} ${c.unread_count > 0 ? 'unread' : ''}`}
          >
            <Avatar user={c.user} size={48} />
            <div className="conv-text">
              <div className="conv-top">
                <strong className="conv-name">@{c.user.username}</strong>
                <span className="conv-time">{formatChatTime(c.last_message.created_at)}</span>
              </div>
              <div className="conv-bottom">
                <span className="conv-preview">
                  {mine && 'You: '}
                  {c.last_message.message_text}
                </span>
                {c.unread_count > 0 && <span className="badge">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </aside>
);

export default ConversationList;
