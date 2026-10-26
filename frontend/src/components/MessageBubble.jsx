import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { formatMessageTime, formatFileSize, imageUrl, messagePreview } from '../utils/helpers.js';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

const sameEmoji = (a, b) => a.replace(/️/g, '') === b.replace(/️/g, '');

// One chat message. Sent = right side, received = left side.
// The text is rendered as plain React text (React escapes it), so HTML/scripts can never run.
const MessageBubble = ({
  message,
  isMine,
  sender,
  meId,
  partner,
  status,
  onRetry,
  onDiscard,
  onReply,
  onForward,
  onDelete,
  onReact,
  onJumpTo,
  onMediaLoad,
}) => {
  const [menu, setMenu] = useState(null); // { top|bottom, left|right } while the menu is open
  const buttonRef = useRef(null);

  const unsent = message.is_deleted;
  const unsaved = message.pending || message.failed; // not on the server yet -> no menu
  const att = message.attachment;
  const attUrl = att ? att.local_url || imageUrl(att.path) : null;
  const myReaction = (message.reactions || []).find((r) => r.user_id === meId);

  // ---- menu: opens next to the "⋯" button and closes on any outside click / scroll ----
  const openMenu = () => {
    const rect = buttonRef.current.getBoundingClientRect();
    const style = {};
    if (rect.bottom + 300 > window.innerHeight) style.bottom = window.innerHeight - rect.top + 4;
    else style.top = rect.bottom + 4;
    // Menu is 230px wide: line it up with the button but never let it leave the screen.
    const MENU_WIDTH = 230;
    const wanted = isMine ? rect.right - MENU_WIDTH : rect.left;
    style.left = Math.min(Math.max(wanted, 8), Math.max(window.innerWidth - MENU_WIDTH - 8, 8));
    setMenu(style);
  };

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.message_text);
    } catch (e) {
      // clipboard may be blocked - nothing to do
    }
  };

  // ---- reactions grouped: 👍 2  ❤️ 1 ----
  const groups = [];
  (message.reactions || []).forEach((r) => {
    const found = groups.find((g) => sameEmoji(g.emoji, r.emoji));
    if (found) {
      found.count += 1;
      if (r.user_id === meId) found.mine = true;
    } else {
      groups.push({ emoji: r.emoji, count: 1, mine: r.user_id === meId });
    }
  });

  const quoteAuthor = (id) => (id === meId ? 'You' : `@${partner.username}`);

  return (
    <div id={`msg-${message.id}`} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && <Avatar user={sender} size={32} />}

      <div className="msg-col">
        <span className="msg-name">@{sender.username}</span>

        <div className="msg-line">
          <div className={`msg-bubble ${message.failed ? 'failed' : ''} ${message.pending ? 'pending' : ''} ${unsent ? 'unsent' : ''}`}>
            {message.is_forwarded && !unsent && <div className="msg-forwarded">↪ Forwarded</div>}

            {message.reply_to && !unsent && (
              <button type="button" className="msg-quote" onClick={() => onJumpTo(message.reply_to.id)}>
                <strong>{quoteAuthor(message.reply_to.sender_id)}</strong>
                <span>{messagePreview(message.reply_to)}</span>
              </button>
            )}

            {unsent && <span>🚫 This message was deleted</span>}

            {att && !unsent && att.is_image && (
              <a href={attUrl} target="_blank" rel="noopener noreferrer" className="msg-image-link">
                <img className="msg-image" src={attUrl} alt={att.name} onLoad={onMediaLoad} />
              </a>
            )}

            {att && !unsent && !att.is_image && (
              <a
                href={message.pending ? undefined : attUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="msg-file"
                title="Download"
              >
                <span className="msg-file-icon">📄</span>
                <span className="msg-file-info">
                  <strong>{att.name}</strong>
                  <small>{formatFileSize(att.size)}</small>
                </span>
              </a>
            )}

            {!unsent && message.message_text && <div className="msg-text">{message.message_text}</div>}
          </div>

          {!unsaved && (
            <button
              ref={buttonRef}
              className="msg-menu-btn"
              aria-label="Message options"
              onClick={(e) => {
                e.stopPropagation();
                if (menu) setMenu(null);
                else openMenu();
              }}
            >
              ⋯
            </button>
          )}
        </div>

        {groups.length > 0 && !unsent && (
          <div className="msg-reactions">
            {groups.map((g) => (
              <button
                key={g.emoji}
                className={`reaction-chip ${g.mine ? 'mine' : ''}`}
                onClick={() => onReact(message, g.emoji)}
                title={g.mine ? 'Click to remove your reaction' : 'React with this'}
              >
                {g.emoji} {g.count > 1 && <span>{g.count}</span>}
              </button>
            ))}
          </div>
        )}

        <span className="msg-meta">
          {formatMessageTime(message.created_at)}
          {status && <span className="msg-status"> · {status}</span>}
          {message.failed && (
            <>
              <span className="msg-status error"> · Not sent</span>
              <button className="link-btn" onClick={() => onRetry(message)}>Retry</button>
              <button className="link-btn danger" onClick={() => onDiscard(message)}>Discard</button>
            </>
          )}
        </span>
      </div>

      {isMine && <Avatar user={sender} size={32} />}

      {menu && (
        <div className="msg-menu" style={menu} onClick={(e) => e.stopPropagation()}>
          {!unsent && (
            <div className="msg-menu-reactions">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className={myReaction && sameEmoji(myReaction.emoji, emoji) ? 'active' : ''}
                  onClick={() => {
                    setMenu(null);
                    onReact(message, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {!unsent && (
            <button onClick={() => { setMenu(null); onReply(message); }}>↩ Reply</button>
          )}
          {!unsent && (
            <button onClick={() => { setMenu(null); onForward(message); }}>↪ Forward</button>
          )}
          {!unsent && message.message_text && (
            <button onClick={() => { setMenu(null); copyText(); }}>⧉ Copy text</button>
          )}
          <button
            className="danger"
            onClick={() => {
              setMenu(null);
              if (window.confirm('Delete this message for you? The other person will still see it.')) onDelete(message, 'me');
            }}
          >
            🗑 Delete for me
          </button>
          {isMine && !unsent && (
            <button
              className="danger"
              onClick={() => {
                setMenu(null);
                if (window.confirm('Unsend this message for everyone? This cannot be undone.')) onDelete(message, 'everyone');
              }}
            >
              🚫 Unsend for everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;