import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun';
import { RoomManager } from './managers/RoomManager';
import { rateLimiter } from './middleware/rateLimiter';
import { createActionsRouter } from './routes/actions';
import { createDiscoveryRouter } from './routes/discovery';
import { createHealthRouter } from './routes/health';
import { createHistoryRouter } from './routes/history';
import { createMatchesRouter } from './routes/matches';
import { createApiMatchRouter, createMatchRouter, createMatchSocketRoute } from './routes/match';
import { createQueueSocketRoute } from './routes/queueSocket';
import { createQuestionsRouter } from './routes/questions';
import { startEventListener } from './utils/eventListener';

const { upgradeWebSocket, websocket } = createBunWebSocket<unknown>();
const app = new Hono();
const roomManager = new RoomManager();
const matchSocketRoute = createMatchSocketRoute(roomManager);
const queueSocketRoute = createQueueSocketRoute(roomManager);
roomManager.startBlinkJanitor();
roomManager.startPublicRoomJanitor();

// Global middleware
app.use('/*', cors());
app.use('/*', rateLimiter);

// Mounted routers
app.route('/', createDiscoveryRouter());
app.route('/', createHealthRouter());
app.route('/api/actions', createActionsRouter(roomManager));
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
  return queueSocketRoute(address);
}));

// Start the server
const port = parseInt(process.env.PORT || '8080', 10);
console.log(`Server is running on port ${port}`);

// Start Anchor event listener when RPC is configured.
if (process.env.SOLANA_RPC_URL) {
  startEventListener(process.env.SOLANA_RPC_URL, process.env.SOLANA_WS_URL);
} else {
  console.log('[EventListener] Skipped - no SOLANA_RPC_URL configured.');
}

export default {
  port,
  fetch: app.fetch,
  websocket,
};
