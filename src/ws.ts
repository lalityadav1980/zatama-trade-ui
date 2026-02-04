// src/ws.ts
import { io, Socket } from "socket.io-client";

// Derive origin from your API base if you prefer env vars:
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api.zatamap.com/api";
const WS_ORIGIN = new URL(API_BASE).origin; // https://api.zatamap.com

export function connectSocket(): Socket {
  return io(WS_ORIGIN, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
}
