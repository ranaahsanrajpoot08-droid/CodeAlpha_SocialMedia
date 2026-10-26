import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Loading from './Loading.jsx';
import MessageBubble from './MessageBubble.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatFileSize, messagePreview } from '../utils/helpers.js';

const MAX_LENGTH = 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (the server checks too)
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

// Right side of the Messages page: header, history and the message box.
// (Messages.jsx gives it the data and the actions; this component only shows it.)
const ChatWindow = ({
  me,
  partner,
  messages,
  loading,
  error,
  hasMore,
  loadingOlder,
  connected,
  partnerOnline,
  partnerTyping,
  replyingTo,
  onCancelReply,
  onLoadOlder,
  onSend,
  onRetry,
  onDiscard,
  onReply,
  onForward,
  onDelete,
  onReact,
  onClearChat,
  onTyping,
  onBack,
}) => {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [headerMenu, setHeaderMenu] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const lastKey = useRef(null);
  const prevHeight = useRef(null); // remembers the height before older messages are added
  const typingOn = useRef(false);
  const typingTimer = useRef(null);

  // ---- Scrolling ----
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    const last = messages[messages.length - 1];
    const key = last ? `${last.client_id || last.id}:${messages.length}` : null;

    // Older messages were added at the top: keep the same message in view.
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      lastKey.current = key;
      return;
    }

    // First time the history is shown: jump to the newest message.
    if (!didInitialScroll.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      lastKey.current = key;
      return;
    }

    // Reactions, "Seen", unsend ... change a message but add nothing new: do not move the view.
    if (key === lastKey.current) return;
    lastKey.current = key;

    // A new message: scroll down for my own messages, or if I was already near the bottom.
    if (last && (last.sender_id === me.id || nearBottom.current)) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, me.id]);

  const handleScroll = () => {
    const el = listRef.current;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // A photo finished loading and made the list taller: stay at the bottom if we were there.
  const handleMediaLoad = () => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  };

  const loadOlder = () => {
    prevHeight.current = listRef.current.scrollHeight;
    onLoadOlder();
  };

  const jumpTo = (id) => {
    const target = listRef.current?.querySelector(`#msg-${id}`);
    if (!target) {
      showToast('That message is further up. Press "Load older messages" first.', 'error');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1600);
  };

  // ---- Typing indicator ----
  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (typingOn.current) {
      typingOn.current = false;
      onTyping(false);
    }
  };

  const noteTyping = () => {
    if (!typingOn.current) {
      typingOn.current = true;
      onTyping(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2500);
  };

  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Reply / file picking ----
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  useEffect(() => {
    if (!headerMenu) return undefined;
    const close = () => setHeaderMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [headerMenu]);

  const pickFile = (chosen) => {
    if (!chosen) return;
    if (chosen.size > MAX_FILE_SIZE) {
      showToast('File is too large. Maximum size is 10MB.', 'error');
      return;
    }
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(chosen);
    setFilePreview(chosen.type.startsWith('image/') ? URL.createObjectURL(chosen) : null);
    inputRef.current?.focus();
  };

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
  };

  // Ctrl+V with a copied screenshot / image
  const handlePaste = (e) => {
    const pasted = e.clipboardData?.files?.[0];
    if (pasted) {
      e.preventDefault();
      pickFile(pasted);
    }
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
    if (!value && !file) return;
    stopTyping();
    onSend(value, file);
    setText('');
    clearFile();
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
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === me.id && !messages[i].is_deleted) return i;
    }
    return -1;
  })();

  const canSend = (text.trim().length > 0 || Boolean(file)) && Boolean(partner) && !error;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="Back to conversations">←</button>
        {partner ? (
          <Link to={`/profile/${partner.id}`} className="chat-partner">
            <Avatar user={partner} size={42} online={partnerOnline} />
            <div>
              <strong>{partner.name}</strong>
              <div className="muted small">
                {partnerTyping ? (
                  <span className="typing-text">typing...</span>
                ) : (
                  <>@{partner.username}{partnerOnline && <span className="online-text"> · Online</span>}</>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <strong>Chat</strong>
        )}

        {partner && (
          <div className="chat-header-menu">
            <button
              className="msg-menu-btn visible"
              aria-label="Chat options"
              onClick={(e) => {
                e.stopPropagation();
                setHeaderMenu(!headerMenu);
              }}
            >
              ⋯
            </button>
            {headerMenu && (
              <div className="header-dropdown" onClick={(e) => e.stopPropagation()}>
                <button
                  className="danger"
                  onClick={() => {
                    setHeaderMenu(false);
                    if (window.confirm('Clear this chat for you? The other person keeps their copy.')) onClearChat();
                  }}
                >
                  🗑 Clear chat
                </button>
              </div>
            )}
          </div>
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
                meId={me.id}
                partner={partner}
                status={status}
                onRetry={onRetry}
                onDiscard={onDiscard}
                onReply={onReply}
                onForward={onForward}
                onDelete={onDelete}
                onReact={onReact}
                onJumpTo={jumpTo}
                onMediaLoad={handleMediaLoad}
              />
            );
          })}
      </div>

      {replyingTo && partner && (
        <div className="composer-bar reply-bar">
          <div className="composer-bar-text">
            <strong>Replying to {replyingTo.sender_id === me.id ? 'yourself' : `@${partner.username}`}</strong>
            <span>{messagePreview(replyingTo)}</span>
          </div>
          <button onClick={onCancelReply} aria-label="Cancel reply">✕</button>
        </div>
      )}

      {file && (
        <div className="composer-bar attach-bar">
          {filePreview ? <img src={filePreview} alt="" /> : <span className="attach-icon">📄</span>}
          <div className="composer-bar-text">
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)}</span>
          </div>
          <button onClick={clearFile} aria-label="Remove file">✕</button>
        </div>
      )}

      <div className="chat-input">
        <label className="attach-btn" title="Send a photo or file (max 10MB)">
          📎
          <input
            type="file"
            accept={ACCEPT}
            hidden
            disabled={!partner || Boolean(error)}
            onChange={(e) => {
              pickFile(e.target.files[0]);
              e.target.value = ''; // lets you pick the same file again later
            }}
          />
        </label>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={file ? 'Add a caption (optional)...' : 'Type a message...'}
          title="Enter = send, Shift+Enter = new line"
          disabled={!partner || Boolean(error)}
          onChange={(e) => {
            setText(e.target.value);
            resizeInput();
            if (e.target.value) noteTyping();
            else stopTyping();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <button className="btn btn-primary" onClick={submit} disabled={!canSend}>
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
