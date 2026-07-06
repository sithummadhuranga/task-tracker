import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./common/config/env.js";
import { taskEventsEmitter, type TaskSocketServer } from "./websocket/events.js";
import { registerSocketGateway } from "./websocket/gateway.js";

const app = createApp();
// Socket.io needs a real http.Server to attach to — createApp() alone (what supertest drives in
// tests) never has one, so the WebSocket layer only ever comes alive from this entry point.
const httpServer = createServer(app);

const io: TaskSocketServer = new Server(httpServer, {
  cors: { origin: env.CORS_ORIGIN, credentials: true },
});

registerSocketGateway(io);
taskEventsEmitter.attach(io);

httpServer.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});
