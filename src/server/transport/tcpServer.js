import net from 'node:net';

import { attachJsonLineParser, isRecord, sendFrame } from '../../shared/protocol.js';

function normalizeAddress(address) {
  return address?.replace('::ffff:', '') ?? 'unknown';
}

function buildCommandPreview(frame) {
  return [frame.command, frame.filename, frame.path, frame.keyword].filter(Boolean).join(' ');
}

export function createTcpServer({
  socketConfig,
  authConfig,
  connectionRegistry,
  messageStore,
  commandService,
  logger,
}) {
  async function handleFrame(socket, frame) {
    if (!isRecord(frame) || typeof frame.type !== 'string') {
      sendFrame(socket, {
        type: 'error',
        code: 'INVALID_FRAME',
        message: 'Frames must be JSON objects with a string "type" field.',
      });
      return;
    }

    const session = connectionRegistry.getSession(socket);

    if (!session) {
      return;
    }

    connectionRegistry.touch(socket);
    socket.setTimeout(socketConfig.inactivityTimeoutMs);

    if (frame.type === 'hello') {
      const clientId = String(frame.clientId ?? '').trim();
      const name = String(frame.name ?? '').trim() || clientId;

      if (!clientId) {
        sendFrame(socket, {
          type: 'error',
          code: 'INVALID_HELLO',
          message: 'clientId is required in the hello frame.',
        });
        return;
      }

      const role = frame.adminToken && frame.adminToken === authConfig.adminSecret ? 'admin' : 'readonly';
      const registration = connectionRegistry.bindClient(socket, { clientId, name, role });

      if (registration.replacedSession?.socket) {
        sendFrame(registration.replacedSession.socket, {
          type: 'system',
          message: 'This session was replaced by a reconnecting client.',
        });
        registration.replacedSession.socket.end();
      }

      sendFrame(socket, {
        type: 'hello_ack',
        clientId,
        name,
        role,
        reconnectCount: registration.knownClient.reconnectCount,
        message: role === 'admin'
          ? 'Admin access granted.'
          : 'Read-only access granted.',
      });

      logger.info('Client registered.', {
        socketId: registration.session.socketId,
        clientId,
        role,
        remoteAddress: registration.session.remoteAddress,
      });
      return;
    }

    if (!session.clientId) {
      sendFrame(socket, {
        type: 'error',
        code: 'HELLO_REQUIRED',
        message: 'Send a hello frame before other operations.',
      });
      return;
    }

    if (frame.type === 'chat') {
      const text = String(frame.text ?? '').trim();

      if (!text) {
        sendFrame(socket, {
          type: 'error',
          code: 'EMPTY_MESSAGE',
          message: 'Chat messages cannot be empty.',
        });
        return;
      }

      const entry = messageStore.record({
        kind: 'chat',
        clientId: session.clientId,
        role: session.role,
        remoteAddress: session.remoteAddress,
        preview: text.slice(0, 300),
      });

      sendFrame(socket, {
        type: 'ack',
        message: 'Message received by the server.',
        receivedAt: entry.receivedAt,
      });
      return;
    }

    if (frame.type === 'command') {
      messageStore.record({
        kind: 'command',
        clientId: session.clientId,
        role: session.role,
        remoteAddress: session.remoteAddress,
        preview: buildCommandPreview(frame),
      });

      try {
        const result = await commandService.execute(session, frame);
        sendFrame(socket, {
          type: 'command_result',
          ok: true,
          ...result,
        });
      } catch (error) {
        sendFrame(socket, {
          type: 'command_result',
          ok: false,
          command: String(frame.command ?? 'unknown'),
          error: error.message,
        });
      }
      return;
    }

    sendFrame(socket, {
      type: 'error',
      code: 'UNKNOWN_FRAME',
      message: `Unsupported frame type "${frame.type}".`,
    });
  }

  const server = net.createServer((socket) => {
    const remoteAddress = normalizeAddress(socket.remoteAddress);

    if (!connectionRegistry.canAcceptConnection(socketConfig.maxConnections)) {
      logger.warn('Rejected connection because the connection limit was reached.', {
        remoteAddress,
        maxConnections: socketConfig.maxConnections,
      });
      sendFrame(socket, {
        type: 'error',
        code: 'CONNECTION_LIMIT',
        message: `Connection limit reached (${socketConfig.maxConnections}).`,
      });
      socket.end();
      return;
    }

    const registration = connectionRegistry.registerSocket(socket, remoteAddress);
    socket.setEncoding('utf8');
    socket.setTimeout(socketConfig.inactivityTimeoutMs);

    logger.info('Socket connected.', {
      socketId: registration.socketId,
      remoteAddress,
    });

    let frameQueue = Promise.resolve();

    attachJsonLineParser(socket, {
      onFrame: (frame) => {
        frameQueue = frameQueue
          .then(() => handleFrame(socket, frame))
          .catch((error) => {
            logger.error('Unhandled frame processing error.', {
              socketId: registration.socketId,
              remoteAddress,
              error,
            });
            sendFrame(socket, {
              type: 'error',
              code: 'FRAME_PROCESSING_ERROR',
              message: 'The server failed while processing a frame.',
            });
          });
      },
      onParseError: (error, rawLine) => {
        logger.warn('Failed to parse client frame.', {
          socketId: registration.socketId,
          rawLine,
          error: error.message,
        });
        sendFrame(socket, {
          type: 'error',
          code: 'PARSE_ERROR',
          message: 'Server could not parse the incoming JSON frame.',
        });
      },
    });

    socket.on('timeout', () => {
      logger.info('Socket closed for inactivity.', {
        socketId: registration.socketId,
        timeoutMs: socketConfig.inactivityTimeoutMs,
      });
      sendFrame(socket, {
        type: 'system',
        message: `Disconnected after ${socketConfig.inactivityTimeoutMs}ms of inactivity.`,
      });
      socket.end();
    });

    socket.on('error', (error) => {
      logger.error('Socket error.', {
        socketId: registration.socketId,
        remoteAddress,
        error,
      });
    });

    socket.on('close', () => {
      const closedSession = connectionRegistry.unregisterSocket(socket, 'closed');

      if (!closedSession) {
        return;
      }

      logger.info('Socket disconnected.', {
        socketId: closedSession.socketId,
        clientId: closedSession.clientId,
        remoteAddress: closedSession.remoteAddress,
      });
    });
  });

  server.on('error', (error) => {
    logger.error('TCP server error.', error);
  });

  return server;
}
