import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const port = Number(process.env.WIFI_SOUND_SIGNAL_PORT ?? '8787');
const host = process.env.WIFI_SOUND_SIGNAL_HOST ?? '0.0.0.0';

/**
 * @typedef {'host' | 'client' | 'observer'} PeerRole
 *
 * @typedef PeerInfo
 * @property {WebSocket} ws
 * @property {PeerRole} role
 * @property {string | null} roomId
 * @property {string} name
 * @property {string | null} targetHostId
 * @property {string | null} address
 * @property {number} lastSeenAt
 * @property {boolean} isAlive
 */

/** @type {Map<string, PeerInfo>} */
const peers = new Map();

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        status: 'ok',
        connectedPeers: peers.size,
        hostCount: collectHosts().length,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Wi-Fi Sound Thing signaling server is running.\n');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, request) => {
  const peerId = randomUUID();
  const remoteAddress =
    request.socket.remoteAddress === '::1'
      ? '127.0.0.1'
      : request.socket.remoteAddress ?? 'unknown';

  peers.set(peerId, {
    ws,
    role: 'observer',
    roomId: null,
    name: `peer-${peerId.slice(0, 8)}`,
    targetHostId: null,
    address: null,
    lastSeenAt: Date.now(),
    isAlive: true,
  });

  sendToSocket(ws, {
    type: 'welcome',
    clientId: peerId,
    now: Date.now(),
    remoteAddress,
  });
  sendToSocket(ws, {
    type: 'hosts-state',
    hosts: collectHosts(),
  });

  ws.on('pong', () => {
    const existing = peers.get(peerId);
    if (existing) {
      existing.isAlive = true;
      existing.lastSeenAt = Date.now();
    }
  });

  ws.on('message', (raw) => {
    const payload = parseJson(raw);
    if (!payload) {
      sendError(ws, 'Invalid JSON payload.');
      return;
    }
    handleMessage(peerId, payload);
  });

  ws.on('close', () => {
    removePeer(peerId);
  });

  ws.on('error', () => {
    removePeer(peerId);
  });
});

const heartbeatTimer = setInterval(() => {
  for (const [peerId, peer] of peers.entries()) {
    if (!peer.isAlive) {
      peer.ws.terminate();
      removePeer(peerId);
      continue;
    }
    peer.isAlive = false;
    peer.ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

httpServer.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[signal] listening on ws://${host}:${port}`);
});

/**
 * @param {string} peerId
 * @param {Record<string, unknown>} payload
 */
function handleMessage(peerId, payload) {
  const peer = peers.get(peerId);
  if (!peer) {
    return;
  }

  const type = typeof payload.type === 'string' ? payload.type : null;
  if (!type) {
    sendError(peer.ws, 'Missing "type" field.');
    return;
  }

  peer.lastSeenAt = Date.now();

  switch (type) {
    case 'hello': {
      const role = normalizeRole(payload.role);
      const roomId = normalizeOptionalString(payload.roomId) ?? 'default-room';
      const name = normalizeOptionalString(payload.name) ?? `${role}-${peerId.slice(0, 8)}`;
      const targetHostId = normalizeOptionalString(payload.targetHostId);
      const address = normalizeOptionalString(payload.address);

      peer.role = role;
      peer.roomId = roomId;
      peer.name = name;
      peer.targetHostId = targetHostId;
      peer.address = address;

      if (role === 'client') {
        notifyHostsAboutClientJoin(peerId);
      }

      broadcastHostsState();
      sendToSocket(peer.ws, {
        type: 'hello-ack',
        clientId: peerId,
        role,
        roomId,
      });
      return;
    }

    case 'hosts-request': {
      sendToSocket(peer.ws, {
        type: 'hosts-state',
        hosts: collectHosts(),
      });
      return;
    }

    case 'host-meta-update': {
      if (peer.role !== 'host') {
        sendError(peer.ws, 'Only hosts can send host-meta-update.');
        return;
      }
      peer.name = normalizeOptionalString(payload.name) ?? peer.name;
      peer.roomId = normalizeOptionalString(payload.roomId) ?? peer.roomId;
      peer.address = normalizeOptionalString(payload.address) ?? peer.address;
      broadcastHostsState();
      return;
    }

    case 'offer':
    case 'answer':
    case 'ice-candidate':
    case 'sync-start': {
      forwardToTarget(peerId, payload);
      return;
    }

    case 'ping': {
      sendToSocket(peer.ws, {
        type: 'pong',
        now: Date.now(),
      });
      return;
    }

    default: {
      sendError(peer.ws, `Unsupported message type "${type}".`);
    }
  }
}

/**
 * @param {string} senderId
 * @param {Record<string, unknown>} payload
 */
function forwardToTarget(senderId, payload) {
  const to = normalizeOptionalString(payload.to);
  if (!to) {
    const sender = peers.get(senderId);
    if (sender) {
      sendError(sender.ws, `Message "${String(payload.type)}" is missing "to".`);
    }
    return;
  }

  const target = peers.get(to);
  if (!target) {
    const sender = peers.get(senderId);
    if (sender) {
      sendError(sender.ws, `Target "${to}" is not connected.`);
    }
    return;
  }

  sendToSocket(target.ws, {
    ...payload,
    from: senderId,
  });
}

/**
 * @param {string} clientPeerId
 */
function notifyHostsAboutClientJoin(clientPeerId) {
  const client = peers.get(clientPeerId);
  if (!client || client.role !== 'client' || !client.roomId) {
    return;
  }

  if (client.targetHostId) {
    const targetHost = peers.get(client.targetHostId);
    if (targetHost && targetHost.role === 'host') {
      sendToSocket(targetHost.ws, {
        type: 'peer-joined',
        peerId: clientPeerId,
        roomId: client.roomId,
        name: client.name,
      });
      return;
    }
  }

  for (const [peerId, peer] of peers.entries()) {
    if (peerId === clientPeerId) {
      continue;
    }
    if (peer.role === 'host' && peer.roomId === client.roomId) {
      sendToSocket(peer.ws, {
        type: 'peer-joined',
        peerId: clientPeerId,
        roomId: client.roomId,
        name: client.name,
      });
    }
  }
}

/**
 * @param {string} peerId
 */
function removePeer(peerId) {
  const departing = peers.get(peerId);
  if (!departing) {
    return;
  }

  peers.delete(peerId);

  if (departing.role === 'host') {
    broadcastHostsState();
  }

  if (departing.role === 'client' && departing.roomId) {
    if (departing.targetHostId) {
      const targetHost = peers.get(departing.targetHostId);
      if (targetHost && targetHost.role === 'host') {
        sendToSocket(targetHost.ws, {
          type: 'peer-left',
          peerId,
          roomId: departing.roomId,
        });
      }
      return;
    }

    for (const [hostPeerId, hostPeer] of peers.entries()) {
      if (hostPeerId === peerId) {
        continue;
      }
      if (hostPeer.role === 'host' && hostPeer.roomId === departing.roomId) {
        sendToSocket(hostPeer.ws, {
          type: 'peer-left',
          peerId,
          roomId: departing.roomId,
        });
      }
    }
  }
}

function collectHosts() {
  const now = Date.now();
  const hosts = [];
  for (const [peerId, peer] of peers.entries()) {
    if (peer.role !== 'host') {
      continue;
    }
    hosts.push({
      id: peerId,
      roomId: peer.roomId ?? 'default-room',
      name: peer.name,
      address: peer.address,
      transport: 'webrtc',
      updatedAt: peer.lastSeenAt,
      ageMs: Math.max(0, now - peer.lastSeenAt),
    });
  }
  return hosts;
}

function broadcastHostsState() {
  const message = {
    type: 'hosts-state',
    hosts: collectHosts(),
  };

  for (const peer of peers.values()) {
    sendToSocket(peer.ws, message);
  }
}

/**
 * @param {WebSocket} ws
 * @param {Record<string, unknown>} payload
 */
function sendToSocket(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

/**
 * @param {WebSocket} ws
 * @param {string} message
 */
function sendError(ws, message) {
  sendToSocket(ws, {
    type: 'error',
    message,
  });
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function parseJson(raw) {
  try {
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    if (raw instanceof Buffer) {
      return JSON.parse(raw.toString('utf8'));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} role
 * @returns {PeerRole}
 */
function normalizeRole(role) {
  if (role === 'host' || role === 'client' || role === 'observer') {
    return role;
  }
  return 'observer';
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
