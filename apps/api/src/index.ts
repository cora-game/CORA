import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun';
import { RoomManager } from './managers/RoomManager';
import { rateLimiter } from './middleware/rateLimiter';
import { createDiscoveryRouter } from './routes/discovery';
import { createHealthRouter } from './routes/health';
import { createHistoryRouter } from './routes/history';
import { createMatchesRouter } from './routes/matches';
import { createApiMatchRouter, createMatchRouter, createMatchSocketRoute } from './routes/match';
import { createQueueSocketRoute } from './routes/queueSocket';
import { createQuestionsRouter } from './routes/questions';
import { startEventListener } from './utils/eventListener';

// Last-resort safety net: this server holds all matchmaking/room state in memory and
// runs a single instance, so a stray unhandled rejection/exception must NOT crash the
// process — that would drop every live match at once. Log loudly and stay alive; the
// failing operation is already isolated to one match's handler.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL-GUARD] Unhandled promise rejection (process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL-GUARD] Uncaught exception (process kept alive):', err);
});

const { upgradeWebSocket, websocket } = createBunWebSocket<unknown>();
const app = new Hono();
const roomManager = new RoomManager();
const matchSocketRoute = createMatchSocketRoute(roomManager);
const queueSocketRoute = createQueueSocketRoute(roomManager);
roomManager.startBlinkJanitor();
roomManager.startPublicRoomJanitor();

// Global middleware
// Restrict CORS to the configured frontend origin(s). Set FE_BASE_URL (comma-separated
// for multiple) in production to your deployed web origin(s). When unset, CORS stays
// permissive so local and devnet development keeps working without extra config.
const allowedOrigins = (process.env.FE_BASE_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use('/*', cors({
  origin: (origin) => {
    if (!origin) return origin; // non-browser / same-origin requests have no Origin header
    if (allowedOrigins.includes(origin)) return origin;
    // Allow localhost during development regardless of FE_BASE_URL.
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return origin;
    }
    // No FE_BASE_URL configured -> permissive; otherwise block unknown origins.
    return allowedOrigins.length === 0 ? origin : null;
  },
  credentials: true,
}));
app.use('/*', rateLimiter);

// Mounted routers
app.route('/', createDiscoveryRouter());
app.route('/', createHealthRouter());
app.route('/api/history', createHistoryRouter());
app.route('/api/matches', createMatchesRouter(roomManager));
app.route('/api/match', createApiMatchRouter(roomManager));
app.route('/api', createQuestionsRouter());
app.route('/match', createMatchRouter(roomManager));

// WebSocket match route (room-level)
app.get('/match/:roomId', upgradeWebSocket((c) => {
  const roomId = c.req.param('roomId');
  const address = c.req.query('address');
  const characterId = c.req.query('characterId') || 'einstein';

  return matchSocketRoute(roomId, address, characterId);
}));

// WebSocket queue route (matchmaking)
app.get('/queue', upgradeWebSocket((c) => {
  const address = c.req.query('address');
  const token = c.req.query('token');
  return queueSocketRoute(address, token);
}));

// Start the server
const port = parseInt(process.env.PORT || '8080', 10);
console.log(`Server is running on port ${port}`);

// Start CoraEscrow event listener when the contract address is configured.
startEventListener();

export default {
  port,
  fetch: app.fetch,
  websocket,
};
