// src/api.js
import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * REST base
 */
const HTTP_BASE_URL = 'https://api.zatamap.com/api';
// const HTTP_BASE_URL = 'http://127.0.0.1:5001/api';

const httpApi = axios.create({
  baseURL: HTTP_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false, // Explicitly disable credentials for CORS
  timeout: 30000, // 30 second timeout
});

// Add request interceptor for better CORS handling
httpApi.interceptors.request.use(
  (config) => {
    // Ensure headers are set for CORS
    config.headers['Accept'] = 'application/json';
    config.headers['Content-Type'] = 'application/json';
    return config;
  },
  (error) => Promise.reject(error)
);

// Clean/normalize JSON responses (handle NaN safely)
httpApi.interceptors.response.use(
  (response) => {
    if (typeof response.data === 'string') {
      try {
        const cleanedData = response.data.replace(/:\s*NaN\s*([,}])/g, ': null$1');
        response.data = JSON.parse(cleanedData);
      } catch (error) {
        console.warn('Failed to parse response as JSON:', error);
      }
    }
    if (response.data && typeof response.data === 'object') {
      response.data = JSON.parse(JSON.stringify(response.data, (key, value) => {
        return (typeof value === 'number' && isNaN(value)) ? null : value;
      }));
    }
    return response;
  },
  (error) => {
    // Better CORS error logging
    if (error.message === 'Network Error') {
      console.error('CORS/Network Error:', {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        message: 'Check if backend API has CORS headers configured'
      });
    }
    return Promise.reject(error);
  }
);

/**
 * Socket.IO
 * - Server namespace: /ws
 * - Transport path:   /socket.io
 */
const WS_ORIGIN = new URL(HTTP_BASE_URL).origin;       // e.g. https://api.zatamap.com
const WS_NAMESPACE_URL = `${WS_ORIGIN}/ws`;            // connect to the /ws namespace

/**
 * Connect to Socket.IO server (namespace /ws).
 * Usage:
 *   const socket = connectSocket();
 *   socket.on('stream', (msg) => console.log(msg));
 */
function connectSocket(overrides = {}) {
  return io(WS_NAMESPACE_URL, {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    autoConnect: true,
    ...overrides,
  });
}

/**
 * Hub REST helpers
 */

// Get latest state. If `topics` is omitted/empty, server returns ALL known topics.
async function wsState({ topics, limit = 1, prefix, latest = false } = {}) {
  const params = {};
  if (limit != null) params.limit = limit;

  if (prefix) {
    params.prefix = prefix;
  }

  // Only include topics if explicitly provided and non-empty
  if (Array.isArray(topics) && topics.length) {
    params.topics = topics.join(',');
  } else if (typeof topics === 'string' && topics.trim().length) {
    params.topics = topics.trim();
  }

  const endpoint = latest ? '/ws/state/latest' : '/ws/state';
  const { data } = await httpApi.get(endpoint, { params });
  return data;
}

// Optional: publish (enabled only if your server allows it / token set)
async function wsPublish({ topic, data, token }) {
  const headers = token ? { 'X-WS-TOKEN': token } : undefined;
  const res = await httpApi.post('/ws/publish', { topic, data }, { headers });
  return res.data;
}

// Optional: quick metrics check
async function wsMetrics() {
  const { data } = await httpApi.get('/ws/metrics');
  return data;
}

export {
  httpApi,
  connectSocket,
  wsState,
  wsPublish,
  wsMetrics,
  WS_ORIGIN,
  WS_NAMESPACE_URL,
};