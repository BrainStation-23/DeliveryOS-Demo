import { io, Socket } from 'socket.io-client';
import { ADMIN_TOKEN_KEY } from './apiClient';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    socket = io('/events', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
    // Re-read the rotated token on every reconnect so handshakes never replay
    // a stale credential.
    socket.io.on('reconnect_attempt', () => {
      const fresh = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (fresh && socket) {
        socket.auth = { token: fresh };
      }
    });
  }
  return socket;
};

export const connectSocket = () => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return;

  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    s.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
