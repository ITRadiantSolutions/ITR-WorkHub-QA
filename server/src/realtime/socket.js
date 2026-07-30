import { Server } from "socket.io";
import { verifyToken } from "../utils/jwt.js";

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL, credentials: true } });

  io.use((socket, next) => {
    try {
      const decoded = verifyToken(socket.handshake.auth?.token);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user_${socket.userId}`);
  });

  return io;
}

export function getIO() {
  return io;
}
