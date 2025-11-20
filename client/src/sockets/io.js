// src/sockets/io.js
import { io } from 'socket.io-client';

let socket = null;
let manualDisconnect = false;

/**
 * Инициализация сокета под конкретный accessToken
 */
export function initSocket(accessToken) {
  if (!accessToken) return null;

  // если уже есть сокет с этим токеном — возвращаем
  if (socket && socket.auth && socket.auth.token === accessToken) {
    return socket;
  }

  // если сокет есть, но с другим токеном — гасим
  if (socket) {
    try {
      manualDisconnect = true;
      socket.disconnect();
    } catch {}
    socket = null;
  }

  manualDisconnect = false;

  const baseURL =
    process.env.REACT_APP_API_URL || 'http://localhost:5001';

  socket = io(baseURL, {
    transports: ['websocket'],
    auth: { token: accessToken },

    // авто-переподключение
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected', reason);
    if (manualDisconnect) {
      console.log('[socket] manual disconnect, no reconnect');
    } else {
      // socket.io сам будет пробовать reconnection
      console.log('[socket] will try to reconnect automatically');
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('[socket] connect_error', err.message);
  });

  return socket;
}

/**
 * Слушает, но НЕ создаёт новый сокет
 */
export function getSocket() {
  return socket;
}

/**
 * Полное выключение сокета (логин/логаут/смена юзера)
 */
export function destroySocket() {
  if (socket) {
    try {
      manualDisconnect = true;
      socket.disconnect();
    } catch (e) {
      console.warn('[socket] destroy error', e);
    } finally {
      socket = null;
    }
  }
}