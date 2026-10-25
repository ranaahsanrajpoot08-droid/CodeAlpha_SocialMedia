import Avatar from './Avatar.jsx';
import { formatMessageTime } from '../utils/helpers.js';

// One chat message. Sent = right side, received = left side.
// The text is rendered as plain React text (React escapes it), so HTML/scripts can never run.
const MessageBubble = ({ message, isMine, sender, status, onRetry }) => (
  <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
    {!isMine && <Avatar user={sender} size={32} />}

    <div className="msg-col">
      <span className="msg-name">@{sender.username}</span>
      <div className={`msg-bubble ${message.failed ? 'failed' : ''} ${message.pending ? 'pending' : ''}`}>
        {message.message_text}
      </div>
      <span className="msg-meta">
        {formatMessageTime(message.created_at)}
        {status && <span className="msg-status"> · {status}</span>}
        {message.failed && (
          <>
            <span className="msg-status error"> · Not sent</span>
            <button className="link-btn" onClick={() => onRetry(message)}>Retry</button>
          </>
        )}
      </span>
    </div>

    {isMine && <Avatar user={sender} size={32} />}
  </div>
);

export default MessageBubble;
