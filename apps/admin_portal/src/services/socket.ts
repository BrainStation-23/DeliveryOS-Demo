import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem('deliveryos_admin_token') || '';
    socket = io('/events', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
    // Access tokens rotate (15m): every reconnect must re-read the stored
    // token or the handshake would replay a stale, already-expired credential.
    socket.io.on('reconnect_attempt', () => {
      const fresh = localStorage.getItem('deliveryos_admin_token');
      if (fresh && socket) {
        socket.auth = { token: fresh };
      }
    });
  }
  return socket;
};

export const connectSocket = () => {
  const token = localStorage.getItem('deliveryos_admin_token');
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
