import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Loading from './Loading.jsx';
import MessageBubble from './MessageBubble.jsx';

const MAX_LENGTH = 1000;

// Right side of the Messages page: header, history and the message box.
// (Messages.jsx gives it the data; this component only shows it.)
const ChatWindow = ({
  me,
  partner,
  messages,
  loading,
  error,
  hasMore,
  loadingOlder,
  connected,
  onLoadOlder,
  onSend,
  onRetry,
  onBack,
}) => {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const prevHeight = useRef(null); // remembers the height before older messages are added

  // ---- Scrolling ----
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;

    // Older messages were added at the top: keep the same message in view.
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }

    // First time the history is shown: jump to the newest message.
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }

    // Later: scroll down for my own messages, or if I was already near the bottom.
    const last = messages[messages.length - 1];
    if (last && (last.sender_id === me.id || nearBottom.current)) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, me.id]);

  const handleScroll = () => {
    const el = listRef.current;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadOlder = () => {
    prevHeight.current = listRef.current.scrollHeight;
    onLoadOlder();
  };

  // ---- Sending ----
  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    nearBottom.current = true;
    requestAnimationFrame(() => {
      resizeInput();
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e) => {
    // Enter = send, Shift+Enter = new line
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // The "Seen / Sent" label goes under my LAST message only.
  const lastMineIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === me.id) return i;
    return -1;
  })();

  const canSend = text.trim().length > 0;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="Back to conversations">←</button>
        {partner ? (
          <Link to={`/profile/${partner.id}`} className="chat-partner">
            <Avatar user={partner} size={42} />
            <div>
              <strong>{partner.name}</strong>
              <div className="muted small">@{partner.username}</div>
            </div>
          </Link>
        ) : (
          <strong>Chat</strong>
        )}
      </header>

      {!connected && <div className="chat-banner">Reconnecting... messages will still be saved.</div>}

      <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
        {loading && <Loading text="Loading messages..." />}

        {!loading && error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && hasMore && (
          <button className="btn btn-ghost chat-older" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? 'Loading...' : 'Load older messages'}
          </button>
        )}

        {!loading && !error && messages.length === 0 && partner && (
          <div className="chat-empty">
            <Avatar user={partner} size={72} />
            <p><strong>{partner.name}</strong></p>
            <p className="muted small">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {!loading &&
          !error &&
          partner &&
          messages.map((m, index) => {
            const isMine = m.sender_id === me.id;
            let status = null;
            if (isMine && index === lastMineIndex && !m.failed) {
              status = m.pending ? 'Sending...' : m.is_read ? 'Seen' : 'Sent';
            }
            return (
              <MessageBubble
                key={m.client_id || m.id}
                message={m}
                isMine={isMine}
                sender={isMine ? me : partner}
                status={status}
                onRetry={onRetry}
              />
            );
          })}
      </div>

      <div className="chat-input">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder="Type a message..."
          title="Enter = send, Shift+Enter = new line"
          disabled={!partner || Boolean(error)}
          onChange={(e) => {
            setText(e.target.value);
            resizeInput();
          }}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn-primary" onClick={submit} disabled={!canSend || !partner || Boolean(error)}>
          Send
        </button>
        {text.length > MAX_LENGTH - 200 && (
          <span className="chat-count muted small">{text.length}/{MAX_LENGTH}</span>
        )}
      </div>
    </section>
  );
};

export default ChatWindow;
