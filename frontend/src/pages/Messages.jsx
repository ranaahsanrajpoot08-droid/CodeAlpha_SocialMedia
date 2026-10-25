import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ConversationList from '../components/ConversationList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  fetchConversations,
  fetchMessages,
  markMessagesRead,
  sendMessageRest,
  getErrorMessage,
} from '../services/api.js';

// Adds a message to a list without ever creating duplicates:
//  - same id            -> already there, ignore
//  - same client_id     -> replace the temporary "sending..." message with the saved one
const addMessage = (list, msg) => {
  if (list.some((m) => m.id === msg.id)) return list;
  const i = msg.client_id ? list.findIndex((m) => m.client_id === msg.client_id && m.sender_id === msg.sender_id) : -1;
  if (i !== -1) {
    const copy = [...list];
    copy[i] = msg;
    return copy;
  }
  return [...list, msg];
};

const newClientId = (userId) => `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const Messages = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { socket, connected, refreshUnread } = useSocket();
  const { showToast } = useToast();

  const activeId = userId && /^\d+$/.test(userId) ? Number(userId) : null;

  // ---- Inbox (left side) ----
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState('');
  const conversationsRef = useRef([]);
  conversationsRef.current = conversations;

  // ---- Open chat (right side) ----
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.conversations);
      setConvError('');
    } catch (error) {
      setConvError(getErrorMessage(error));
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Tell the server I have read this chat, then clear its unread badges.
  const markActiveRead = useCallback(
    (id) => {
      markMessagesRead(id)
        .then(() => {
          setConversations((prev) => prev.map((c) => (c.user.id === id ? { ...c, unread_count: 0 } : c)));
          refreshUnread();
        })
        .catch(() => {});
    },
    [refreshUnread]
  );

  // Puts a message at the top of the inbox (creating the conversation if it is new).
  const upsertConversation = useCallback((chatUser, message, unreadDelta) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.user.id === chatUser.id);
      const existing = index !== -1 ? prev[index] : { user: chatUser, unread_count: 0 };
      if (existing.last_message && existing.last_message.id > message.id) return prev; // older/duplicate event
      const updated = {
        ...existing,
        user: { ...existing.user, ...chatUser },
        last_message: {
          id: message.id,
          sender_id: message.sender_id,
          message_text: message.message_text,
          created_at: message.created_at,
        },
        unread_count: unreadDelta === 'reset' ? 0 : existing.unread_count + unreadDelta,
      };
      return [updated, ...prev.filter((c) => c.user.id !== chatUser.id)];
    });
  }, []);

  // ---- Load the conversation when the URL changes (/messages/:userId) ----
  const loadThread = useCallback(
    async (id, { silent = false } = {}) => {
      if (!silent) {
        setThreadLoading(true);
        setThreadError('');
      }
      try {
        const data = await fetchMessages(id, { limit: 30 });
        setPartner(data.user);
        if (silent) {
          // after a reconnect: merge what we missed into what we already show
          setMessages((prev) => data.messages.reduce(addMessage, prev));
        } else {
          setMessages(data.messages);
          setHasMore(data.hasMore);
        }
        markActiveRead(id);
      } catch (error) {
        if (!silent) setThreadError(getErrorMessage(error));
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [markActiveRead]
  );

  useEffect(() => {
    setPartner(null);
    setMessages([]);
    setHasMore(false);
    setThreadError('');
    if (activeId && activeId !== me.id) loadThread(activeId);
  }, [activeId, me.id, loadThread]);

  // ---- Real-time events ----
  useEffect(() => {
    if (!socket) return undefined;

    const onNew = (message) => {
      const mine = message.sender_id === me.id;
      const partnerId = mine ? message.receiver_id : message.sender_id;
      const isActive = partnerId === activeId;

      // 1) the open chat
      if (isActive) {
        setMessages((prev) => addMessage(prev, message));
        if (!mine && !document.hidden) markActiveRead(partnerId);
      }

      // 2) the inbox on the left
      const known = conversationsRef.current.find((c) => c.user.id === partnerId);
      if (known || (isActive && partner)) {
        const chatUser = known ? known.user : partner;
        const reading = isActive && !document.hidden;
        upsertConversation(chatUser, message, mine ? 0 : reading ? 'reset' : 1);
      } else {
        loadConversations(); // brand new person: we need their name and picture
      }
    };

    // The other person read my messages -> show "Seen"
    const onRead = ({ readerId }) => {
      if (readerId !== activeId) return;
      setMessages((prev) => prev.map((m) => (m.sender_id === me.id ? { ...m, is_read: true } : m)));
    };

    socket.on('message:new', onNew);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:read', onRead);
    };
  }, [socket, me.id, activeId, partner, markActiveRead, upsertConversation, loadConversations]);

  // After the connection drops and comes back: fetch what we missed.
  const wasConnected = useRef(false);
  const wasDown = useRef(false);
  useEffect(() => {
    if (connected) {
      if (wasConnected.current && wasDown.current) {
        loadConversations();
        if (activeId && activeId !== me.id) loadThread(activeId, { silent: true });
      }
      wasConnected.current = true;
      wasDown.current = false;
    } else if (wasConnected.current) {
      wasDown.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // If I was reading in a background tab, mark as read when I come back.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && activeId && activeId !== me.id) markActiveRead(activeId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeId, me.id, markActiveRead]);

  // ---- Sending ----
  // Uses the socket when connected. If the socket is down (or does not answer), the SAME
  // clientId is sent through the REST API instead - the server ignores duplicates.
  const deliver = async (receiverId, text, clientId) => {
    if (socket?.connected) {
      try {
        const reply = await new Promise((resolve, reject) => {
          socket.timeout(8000).emit('message:send', { receiverId, text, clientId }, (err, r) =>
            err ? reject(err) : resolve(r)
          );
        });
        if (reply.ok) return reply.message;
        const refused = new Error(reply.message);
        refused.refused = true; // the server understood us and said no (e.g. rate limit) - do not retry
        throw refused;
      } catch (error) {
        if (error.refused) throw error;
        // timeout / connection problem -> fall through to REST
      }
    }
    const data = await sendMessageRest(receiverId, { text, clientId });
    return data.message;
  };

  const sendText = async (text, existingTemp) => {
    if (!partner) return;
    const receiverId = partner.id;
    const clientId = existingTemp ? existingTemp.client_id : newClientId(me.id);

    if (existingTemp) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: true, failed: false } : m)));
    } else {
      const temp = {
        id: `temp-${clientId}`,
        client_id: clientId,
        sender_id: me.id,
        receiver_id: receiverId,
        message_text: text,
        is_read: false,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, temp]);
    }

    try {
      const saved = await deliver(receiverId, text, clientId);
      setMessages((prev) => addMessage(prev, saved));
      upsertConversation(partner, saved, 0);
    } catch (error) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)));
      showToast(error.refused ? error.message : getErrorMessage(error), 'error');
    }
  };

  const handleLoadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    const oldest = messages.find((m) => typeof m.id === 'number');
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const data = await fetchMessages(activeId, { before: oldest.id, limit: 30 });
      setMessages((prev) => data.messages.reduceRight((list, m) => (list.some((x) => x.id === m.id) ? list : [m, ...list]), prev));
      setHasMore(data.hasMore);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Opening a chat with yourself makes no sense.
  if (activeId === me.id) return <Navigate to="/messages" replace />;

  const chatPartner = partner || conversations.find((c) => c.user.id === activeId)?.user || null;

  return (
    <div className={`messages-layout ${activeId ? 'chat-open' : ''}`}>
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        loading={convLoading}
        error={convError}
        onRetry={loadConversations}
        myId={me.id}
      />

      {activeId ? (
        <ChatWindow
          key={activeId}
          me={me}
          partner={chatPartner}
          messages={messages}
          loading={threadLoading}
          error={threadError}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          connected={connected}
          onLoadOlder={handleLoadOlder}
          onSend={(text) => sendText(text)}
          onRetry={(msg) => sendText(msg.message_text, msg)}
          onBack={() => navigate('/messages')}
        />
      ) : (
        <section className="chat-panel chat-placeholder">
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <h3>Your messages</h3>
            <p className="muted">Select a conversation on the left, or open a profile and press <b>Message</b>.</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default Messages;
