// SocketContext: ONE Socket.IO connection for the whole app, created after login.
// It also keeps the total unread-message number shown in the navbar.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL, fetchUnreadCount } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    fetchUnreadCount()
      .then((data) => setUnreadCount(data.unread_count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Logged out -> no connection.
    if (!userId) {
      setSocket(null);
      setConnected(false);
      setUnreadCount(0);
      return;
    }

    const s = io(SERVER_URL, {
      // A function is re-run on every (re)connect, so we always send the current token.
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      setConnected(true);
      refreshUnread(); // catch up on anything received while we were offline
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    // A new message for me -> update the navbar badge.
    s.on('message:new', (message) => {
      if (message.receiver_id === userId) refreshUnread();
    });
    // I read messages (maybe in another tab) -> update the badge.
    s.on('unread:changed', refreshUnread);

    setSocket(s);
    refreshUnread();

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [userId, refreshUnread]);

  return (
    <SocketContext.Provider value={{ socket, connected, unreadCount, setUnreadCount, refreshUnread }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
};
