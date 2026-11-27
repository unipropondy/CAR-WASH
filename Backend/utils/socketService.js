const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
const clients = new Set();

/**
 * Initialize WebSocket server attached to HTTP server
 */
function initWebSocket(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
      
      if (pathname === '/ws/notifications') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.warn('[WebSocket Upgrade Error]', err.message);
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    clients.add(ws);

    // Send instant welcome / ack
    try {
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        timestamp: new Date().toISOString(),
        message: 'Connected to RedBay Car Wash real-time notification stream'
      }));
    } catch (e) {}

    // Heartbeat ping-pong to keep connections alive through firewalls & NAT
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket Client Error]', clientIp, err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat interval every 25 seconds
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (e) {}
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Real-time notification server initialized on path /ws/notifications');
  return wss;
}

/**
 * Broadcast event to all connected POS / Kiosk clients immediately
 */
function broadcastEvent(type, payload = {}) {
  const messageStr = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
    eventId: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  });

  let deliveredCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        deliveredCount++;
      } catch (err) {
        console.warn('[WebSocket Broadcast Send Error]', err.message);
      }
    }
  });

  console.log(`[WebSocket Broadcast] Event ${type} sent to ${deliveredCount} client(s)`);
}

module.exports = {
  initWebSocket,
  broadcastEvent,
  getClientsCount: () => clients.size
};
