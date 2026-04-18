export class ConnectionRegistry {
  constructor() {
    this.socketCounter = 0;
    this.sockets = new Map();
    this.activeClientSockets = new Map();
    this.knownClients = new Map();
  }

  canAcceptConnection(maxConnections) {
    return this.sockets.size < maxConnections;
  }

  registerSocket(socket, remoteAddress) {
    const now = new Date().toISOString();
    const record = {
      socket,
      socketId: `socket-${++this.socketCounter}`,
      remoteAddress,
      connectedAt: now,
      lastSeenAt: now,
      clientId: null,
      name: null,
      role: 'readonly',
    };

    this.sockets.set(socket, record);
    return { ...record };
  }

  touch(socket) {
    const session = this.sockets.get(socket);

    if (session) {
      session.lastSeenAt = new Date().toISOString();
    }
  }

  bindClient(socket, { clientId, name, role }) {
    const session = this.sockets.get(socket);

    if (!session) {
      throw new Error('Socket is not registered.');
    }

    const now = new Date().toISOString();
    const replacedSocket = this.activeClientSockets.get(clientId);
    const replacedSession = replacedSocket && replacedSocket !== socket ? this.sockets.get(replacedSocket) : null;
    const knownClient = this.knownClients.get(clientId) ?? {
      clientId,
      name,
      role,
      reconnectCount: 0,
      totalConnections: 0,
      remoteAddresses: new Set(),
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastSeenAt: null,
    };

    knownClient.name = name;
    knownClient.role = role;
    knownClient.totalConnections += 1;
    knownClient.reconnectCount = Math.max(0, knownClient.totalConnections - 1);
    knownClient.lastConnectedAt = now;
    knownClient.lastSeenAt = now;
    knownClient.remoteAddresses.add(session.remoteAddress);

    session.clientId = clientId;
    session.name = name;
    session.role = role;
    session.lastSeenAt = now;

    this.activeClientSockets.set(clientId, socket);
    this.knownClients.set(clientId, knownClient);

    return {
      session: { ...session },
      replacedSession: replacedSession ? { ...replacedSession } : null,
      knownClient: {
        ...knownClient,
        remoteAddresses: [...knownClient.remoteAddresses],
      },
    };
  }

  unregisterSocket(socket, reason = 'closed') {
    const session = this.sockets.get(socket);

    if (!session) {
      return null;
    }

    this.sockets.delete(socket);

    if (session.clientId && this.activeClientSockets.get(session.clientId) === socket) {
      this.activeClientSockets.delete(session.clientId);
    }

    if (session.clientId) {
      const knownClient = this.knownClients.get(session.clientId);

      if (knownClient) {
        knownClient.lastDisconnectedAt = new Date().toISOString();
        knownClient.lastSeenAt = session.lastSeenAt;
      }
    }

    return {
      ...session,
      reason,
    };
  }

  getSession(socket) {
    const session = this.sockets.get(socket);
    return session ? { ...session } : null;
  }

  getActiveClients() {
    return [...this.sockets.values()]
      .filter((session) => session.clientId)
      .map((session) => ({
        socketId: session.socketId,
        clientId: session.clientId,
        name: session.name,
        role: session.role,
        remoteAddress: session.remoteAddress,
        connectedAt: session.connectedAt,
        lastSeenAt: session.lastSeenAt,
      }));
  }

  getStats() {
    const activeClients = this.getActiveClients();

    return {
      totalConnectionsSeen: this.socketCounter,
      activeConnections: activeClients.length,
      activeClients,
      clientIps: activeClients.map((client) => client.remoteAddress),
      knownClients: [...this.knownClients.values()].map((client) => ({
        clientId: client.clientId,
        name: client.name,
        role: client.role,
        reconnectCount: client.reconnectCount,
        totalConnections: client.totalConnections,
        remoteAddresses: [...client.remoteAddresses],
        lastConnectedAt: client.lastConnectedAt,
        lastDisconnectedAt: client.lastDisconnectedAt,
        lastSeenAt: client.lastSeenAt,
      })),
    };
  }
}
